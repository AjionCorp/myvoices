"use client";

import { useState, useRef, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useTopicStore } from "@/stores/topic-store";
import { useAuth } from "@/components/auth/AuthProvider";
import { extractYouTubeId } from "@/lib/utils/youtube";
import { getConnection } from "@/lib/spacetimedb/client";

interface VideoMeta {
  videoId: string;
  title: string;
  author: string;
  channelId: string;
  viewCount: string;
  lengthSeconds: string;
  keywords: string[];
  shortDescription: string;
  thumbnail: { url: string; width: number; height: number };
  isLiveContent: boolean;
  isPrivate: boolean;
  category: string;
  publishDate: string;
  ownerChannelName: string;
  ownerProfileUrl: string;
  isFamilySafe: boolean;
  isShortsEligible: boolean;
  likeCount: string;
}

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function formatDuration(seconds: string): string {
  const s = parseInt(seconds, 10);
  if (isNaN(s) || s === 0) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatViews(count: string): string {
  const n = parseInt(count, 10);
  if (isNaN(n)) return count;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B views`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n.toLocaleString()} views`;
}

function formatLikes(count: string): string {
  const n = parseInt(count, 10);
  if (isNaN(n) || n === 0) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(date: string): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

export function SubmissionModal() {
  const { showSubmissionModal, closeSubmissionModal } = useCanvasStore();
  const { activeTopic } = useTopicStore();
  const { isAuthenticated, login, user } = useAuth();

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!showSubmissionModal) return null;

  const handleClose = () => {
    closeSubmissionModal();
    setUrl("");
    setError(null);
    setMeta(null);
    setIsSubmitting(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setError(null);
    setMeta(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (!trimmed) {
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      let videoId: string | null = null;
      if (VIDEO_ID_RE.test(trimmed)) {
        videoId = trimmed;
      } else {
        videoId = extractYouTubeId(trimmed);
      }

      if (!videoId) {
        setError("Enter a valid YouTube URL or video ID");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/v1/video-meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || `Failed to fetch video info (${res.status})`);
          setMeta(null);
        } else {
          const data: VideoMeta = await res.json();
          setMeta(data);
          setError(null);
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      login();
      return;
    }

    if (!meta || !activeTopic) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const conn = getConnection();
      if (!conn) {
        setError("Not connected to server. Please refresh.");
        return;
      }

      const ownerName = user?.username || user?.displayName || "Anonymous";
      const ytViews = BigInt(meta.viewCount || "0");
      const ytLikes = BigInt(meta.likeCount || "0");
      const platform = meta.isShortsEligible ? "youtube_short" : "youtube";

      conn.reducers.claimBlockInTopic({
        topicId: BigInt(activeTopic.id),
        videoId: meta.videoId,
        platform,
        ownerName,
        ytViews,
        ytLikes,
      });

      handleClose();
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const duration = meta ? formatDuration(meta.lengthSeconds) : "";
  const likes = meta ? formatLikes(meta.likeCount) : "";

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Add Video</h2>
            {activeTopic && (
              <p className="text-xs text-muted">
                to <span className="font-medium text-foreground">{activeTopic.title}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-muted transition-colors hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {!isAuthenticated && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent-light">
            You need to sign in to add a video.
          </div>
        )}

        {/* Input */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-muted">
            YouTube URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none transition-colors focus:border-accent"
            disabled={isSubmitting}
          />
          {error && (
            <p className="mt-1.5 text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="mb-4 flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {/* Metadata preview */}
        {meta && !loading && (
          <div className="mb-4 overflow-hidden rounded-lg border border-border">
            {/* Thumbnail */}
            <div className="relative">
              <img
                src={meta.thumbnail.url}
                alt={meta.title}
                className={`${meta.isShortsEligible ? "aspect-9/16" : "aspect-video"} w-full object-cover`}
              />
              {duration && (
                <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                  {duration}
                </span>
              )}
              {meta.isLiveContent && (
                <span className="absolute bottom-2 left-2 rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
                  LIVE
                </span>
              )}
            </div>

            {/* Info */}
            <div className="space-y-2 p-3">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                {meta.title}
              </h3>

              {/* Channel */}
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent-light">
                  {(meta.ownerChannelName || meta.author).charAt(0).toUpperCase()}
                </div>
                <span className="truncate text-xs text-muted">
                  {meta.ownerChannelName || meta.author}
                </span>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {meta.viewCount !== "0" && (
                  <span>{formatViews(meta.viewCount)}</span>
                )}
                {likes && (
                  <>
                    <span className="text-border">·</span>
                    <span>{likes} likes</span>
                  </>
                )}
                {meta.category && (
                  <>
                    <span className="text-border">·</span>
                    <span>{meta.category}</span>
                  </>
                )}
                {meta.publishDate && (
                  <>
                    <span className="text-border">·</span>
                    <span>{formatDate(meta.publishDate)}</span>
                  </>
                )}
              </div>

              {meta.isShortsEligible && (
                <span className="inline-block rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent-light">
                  Short
                </span>
              )}
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {!meta && !loading && !error && url.trim() === "" && (
          <p className="mb-4 text-center text-xs text-muted">
            Paste a YouTube link to preview video details
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-muted transition-colors hover:border-foreground hover:text-foreground"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!meta || loading || isSubmitting}
            className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
          >
            {isSubmitting
              ? "Adding..."
              : isAuthenticated
                ? "Add Video"
                : "Sign In to Add"}
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-muted">
          Your video will be added to the next available position in the spiral.
        </p>
      </div>
    </div>
  );
}
