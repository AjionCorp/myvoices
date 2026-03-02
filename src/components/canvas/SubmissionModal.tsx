"use client";

import { useState, useRef, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useTopicStore } from "@/stores/topic-store";
import { useAuth } from "@/components/auth/AuthProvider";
import { extractYouTubeId } from "@/lib/utils/youtube";
import { getConnection } from "@/lib/spacetimedb/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
    <Dialog open={showSubmissionModal} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-surface sm:max-w-md">
        {/* Header */}
        <DialogHeader className="mb-2">
          <div>
            <DialogTitle>Add Video</DialogTitle>
            {activeTopic && (
              <p className="text-xs text-muted">
                to <span className="font-medium text-foreground">{activeTopic.title}</span>
              </p>
            )}
          </div>
        </DialogHeader>

        {!isAuthenticated && (
          <Card className="mb-4 gap-0 border-accent/30 bg-accent/10 py-0 shadow-none">
            <CardContent className="p-3 text-sm text-accent-light">
            You need to sign in to add a video.
            </CardContent>
          </Card>
        )}

        {/* Input */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-muted">
            YouTube URL
          </label>
          <Input
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="h-10 bg-background"
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

        {/* Metadata preview — always side-by-side so nothing overflows */}
        {meta && !loading && (() => {
          const isPortrait = meta.thumbnail.height > meta.thumbnail.width || meta.isShortsEligible;
          const thumbW = isPortrait ? 96 : 160;
          const thumbH = isPortrait ? 170 : 90;
          return (
          <Card className="mb-4 gap-0 border-border bg-background/50 py-0 shadow-none">
            <CardContent className="flex gap-3 p-3">
            {/* Thumbnail */}
            <div
              className="relative shrink-0 overflow-hidden rounded-lg bg-black"
              style={{ width: thumbW, height: thumbH }}
            >
              <img
                src={meta.thumbnail.url}
                alt={meta.title}
                className="h-full w-full object-cover"
              />
              {duration && (
                <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {duration}
                </span>
              )}
              {meta.isLiveContent && (
                <Badge className="absolute left-1.5 top-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Live
                </Badge>
              )}
            </div>

            {/* Info */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-foreground">
                {meta.title}
              </h3>
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[9px] font-bold text-accent-light">
                  {(meta.ownerChannelName || meta.author).charAt(0).toUpperCase()}
                </div>
                <span className="truncate text-xs font-medium text-muted">
                  {meta.ownerChannelName || meta.author}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-[11px] text-muted">
                <div className="flex items-center gap-1.5">
                  {meta.viewCount !== "0" && <span>{formatViews(meta.viewCount)} views</span>}
                  {likes && <><span className="opacity-30">·</span><span>{likes} likes</span></>}
                </div>
                {(meta.category || meta.publishDate) && (
                  <div className="flex items-center gap-1.5">
                    {meta.category && <span>{meta.category}</span>}
                    {meta.category && meta.publishDate && <span className="opacity-30">·</span>}
                    {meta.publishDate && <span>{formatDate(meta.publishDate)}</span>}
                  </div>
                )}
              </div>
              {isPortrait && (
                <Badge variant="secondary" className="w-fit bg-accent/15 text-accent-light">
                  Short
                </Badge>
              )}
            </div>
            </CardContent>
          </Card>
          );
        })()}

        {/* Empty state hint */}
        {!meta && !loading && !error && url.trim() === "" && (
          <p className="mb-4 text-center text-xs text-muted">
            Paste a YouTube link to preview video details
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!meta || loading || isSubmitting}
            className="flex-1"
          >
            {isSubmitting
              ? "Adding..."
              : isAuthenticated
                ? "Add Video"
                : "Sign In to Add"}
          </Button>
        </div>

        <p className="mt-3 text-center text-xs text-muted">
          Your video will be added to the next available position in the spiral.
        </p>
      </DialogContent>
    </Dialog>
  );
}
