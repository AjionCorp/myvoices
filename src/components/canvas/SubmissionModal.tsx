"use client";

import { useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useAuth } from "@/components/auth/AuthProvider";
import { videoUrlSchema, detectPlatform } from "@/lib/utils/validation";
import { GRID_COLS } from "@/lib/constants";
import { extractYouTubeId, getYouTubeThumbnail, isYouTubeShort } from "@/lib/utils/youtube";
import { isTikTokUrl } from "@/lib/utils/tiktok";

export function SubmissionModal() {
  const { showSubmissionModal, submissionBlockId, closeSubmissionModal } =
    useCanvasStore();
  const { isAuthenticated, login } = useAuth();

  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<{
    thumbnailUrl: string;
    platform: string;
  } | null>(null);

  if (!showSubmissionModal || submissionBlockId === null) return null;

  const handleUrlChange = async (value: string) => {
    setUrl(value);
    setError(null);
    setPreview(null);

    if (!value.trim()) return;

    const result = videoUrlSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    const platform = detectPlatform(value);
    if (!platform) {
      setError("Could not detect platform");
      return;
    }

    if (platform === "youtube" || platform === "youtube_short") {
      const videoId = extractYouTubeId(value);
      if (videoId) {
        setPreview({
          thumbnailUrl: getYouTubeThumbnail(videoId),
          platform,
        });
      }
    } else if (platform === "tiktok") {
      try {
        const res = await fetch(
          `/api/thumbnail/tiktok?url=${encodeURIComponent(value)}`
        );
        if (res.ok) {
          const data = await res.json();
          setPreview({
            thumbnailUrl: data.thumbnailUrl,
            platform,
          });
        }
      } catch {
        // TikTok preview failed silently - submission can still proceed
      }
    }
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      login();
      return;
    }

    const result = videoUrlSchema.safeParse(url);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    const platform = detectPlatform(url);
    if (!platform) {
      setError("Could not detect platform");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let thumbnailUrl = "";

      if (platform === "youtube" || platform === "youtube_short") {
        const videoId = extractYouTubeId(url);
        if (videoId) {
          thumbnailUrl = getYouTubeThumbnail(videoId);
        }
      } else if (platform === "tiktok") {
        const res = await fetch(
          `/api/thumbnail/tiktok?url=${encodeURIComponent(url)}`
        );
        if (res.ok) {
          const data = await res.json();
          thumbnailUrl = data.thumbnailUrl;
        }
      }

      // SpacetimeDB reducer call: claim_block(submissionBlockId, url, thumbnailUrl, platform, userName)
      console.log("Claiming block", {
        blockId: submissionBlockId,
        videoUrl: url,
        thumbnailUrl,
        platform,
      });

      closeSubmissionModal();
      setUrl("");
      setPreview(null);
    } catch (err) {
      setError("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Claim Block #{submissionBlockId}
            </h2>
            <p className="text-xs text-muted">
              Position ({submissionBlockId % GRID_COLS}, {Math.floor(submissionBlockId / GRID_COLS)})
            </p>
          </div>
          <button
            onClick={() => {
              closeSubmissionModal();
              setUrl("");
              setError(null);
              setPreview(null);
            }}
            className="text-muted transition-colors hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {!isAuthenticated && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent-light">
            You need to sign in to claim a block.
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-muted">
            YouTube or TikTok URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=... or https://tiktok.com/@user/video/..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none transition-colors focus:border-accent"
            disabled={isSubmitting}
          />
          {error && (
            <p className="mt-1.5 text-xs text-red-400">{error}</p>
          )}
        </div>

        {preview && (
          <div className="mb-4 overflow-hidden rounded-lg border border-border">
            <img
              src={preview.thumbnailUrl}
              alt="Video preview"
              className="w-full"
            />
            <div className="bg-surface-light px-3 py-2">
              <span className="rounded-md bg-surface px-2 py-0.5 text-xs capitalize text-muted">
                {preview.platform.replace("_", " ")}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => {
              closeSubmissionModal();
              setUrl("");
              setError(null);
              setPreview(null);
            }}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-muted transition-colors hover:border-foreground hover:text-foreground"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!url.trim() || !!error || isSubmitting}
            className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
          >
            {isSubmitting
              ? "Claiming..."
              : isAuthenticated
                ? "Claim Block"
                : "Sign In to Claim"}
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-muted">
          Your video URL is permanent once submitted. Choose wisely!
        </p>
      </div>
    </div>
  );
}
