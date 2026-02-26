"use client";

import { useContestStore } from "@/stores/contest-store";
import { extractYouTubeId, getYouTubeEmbedUrl } from "@/lib/utils/youtube";
import { extractTikTokId, getTikTokEmbedUrl } from "@/lib/utils/tiktok";

export function WinnersHero() {
  const { winners } = useContestStore();

  if (winners.length === 0) return null;

  const getEmbedUrl = (videoUrl: string, platform: string): string | null => {
    if (platform === "youtube" || platform === "youtube_short") {
      const id = extractYouTubeId(videoUrl);
      return id ? getYouTubeEmbedUrl(id) : null;
    }
    if (platform === "tiktok") {
      const id = extractTikTokId(videoUrl);
      return id ? getTikTokEmbedUrl(id) : null;
    }
    return null;
  };

  return (
    <div className="pointer-events-auto absolute left-1/2 top-16 z-30 w-full max-w-3xl -translate-x-1/2 rounded-2xl border border-border bg-surface/95 p-6 shadow-2xl backdrop-blur-sm">
      <div className="mb-4 text-center">
        <h2 className="text-xl font-bold text-foreground">
          Contest Winners
        </h2>
        <p className="mt-1 text-sm text-muted">
          The most liked videos from the last contest
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {winners.slice(0, 2).map((winner) => {
          const embedUrl = getEmbedUrl(winner.videoUrl, winner.platform);

          return (
            <div
              key={winner.blockId}
              className="overflow-hidden rounded-xl border border-border"
            >
              <div className="relative">
                {embedUrl ? (
                  <div className="aspect-video">
                    <iframe
                      src={embedUrl}
                      className="h-full w-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                ) : (
                  winner.thumbnailUrl && (
                    <img
                      src={winner.thumbnailUrl}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  )
                )}
                <div
                  className={`absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-lg ${
                    winner.rank === 1 ? "bg-yellow-500" : "bg-gray-400"
                  }`}
                >
                  #{winner.rank}
                </div>
              </div>

              <div className="bg-surface-light p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {winner.ownerName}
                    </p>
                    <p className="text-xs text-muted">
                      {winner.likes.toLocaleString()} likes
                    </p>
                  </div>
                  <span className="rounded-lg bg-green-500/20 px-2 py-1 text-sm font-semibold text-green-400">
                    ${(winner.prizeAmount / 100).toFixed(2)}
                  </span>
                </div>
                <a
                  href={winner.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block truncate text-xs text-accent-light hover:underline"
                >
                  {winner.videoUrl}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Video URLs are permanent and cannot be changed after submission
      </p>
    </div>
  );
}
