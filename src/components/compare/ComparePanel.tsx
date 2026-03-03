"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getThumbnailUrl } from "@/lib/utils/video-url";
import { Platform } from "@/lib/constants";
import type { ComparePanel as ComparePanelData, CompareBlock } from "@/app/api/v1/compare/route";

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YT",
  youtube_short: "Short",
  tiktok: "TikTok",
  rumble: "Rumble",
  bilibili: "BiliBili",
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function VideoCard({
  block,
  onClick,
}: {
  block: CompareBlock;
  onClick: () => void;
}) {
  const platform = block.platform as Platform;
  const thumbUrl = getThumbnailUrl(block.videoId, platform, block.thumbnailUrl ?? undefined);
  const displayScore = block.ytViews > 0 ? block.ytViews : Math.max(0, block.likes - block.dislikes);
  const platformLabel = PLATFORM_LABELS[block.platform] ?? block.platform;

  return (
    <button
      onClick={onClick}
      className="group w-full flex gap-3 rounded-xl p-2.5 hover:bg-surface transition-colors text-left"
    >
      {/* Thumbnail */}
      <div className="relative w-28 h-16 shrink-0 rounded-lg overflow-hidden bg-surface">
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt=""
            fill
            sizes="112px"
            className="object-cover group-hover:scale-105 transition-transform duration-200"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div className="flex items-start gap-1.5">
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 shrink-0 uppercase tracking-wide"
          >
            {platformLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-auto">
          <span className="text-xs text-muted-foreground">
            {formatCount(displayScore)}{" "}
            <span className="opacity-60">{block.ytViews > 0 ? "views" : "score"}</span>
          </span>
          {block.likes > 0 && (
            <span className="text-xs text-emerald-500/80">
              +{block.likes}
            </span>
          )}
          {block.ownerName && (
            <span className="text-xs text-muted-foreground/60 truncate ml-auto">
              {block.ownerName}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

interface ComparePanelProps {
  panel: ComparePanelData;
  /** Show the × remove button — hidden when only 2 panels remain (min). */
  canRemove: boolean;
  onRemove: () => void;
  /** Called when a video card is clicked — passes the block to play. */
  onSelectBlock: (block: CompareBlock) => void;
  /** Extra CSS class forwarded to the root element (e.g. border dividers). */
  className?: string;
}

export function ComparePanel({
  panel,
  canRemove,
  onRemove,
  onSelectBlock,
  className = "",
}: ComparePanelProps) {
  const { topic, blocks } = panel;
  const crumb = topic.taxonomyPath
    ? topic.taxonomyPath.split("/").filter(Boolean).join(" › ")
    : topic.category;

  return (
    <div className={`flex flex-col min-h-0 overflow-hidden ${className}`}>
      {/* Panel header */}
      <div className="shrink-0 flex items-start gap-2 px-4 py-3 border-b border-border/60 bg-background/60 backdrop-blur-sm">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground leading-tight truncate">
              {topic.title}
            </h2>
            {crumb && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                {crumb}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{topic.videoCount.toLocaleString()} videos</span>
            <span>{formatCount(topic.totalViews)} views</span>
            {topic.totalLikes > 0 && (
              <span className="text-emerald-500/70">+{formatCount(topic.totalLikes)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={`/t/${topic.slug}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-surface"
          >
            Open ↗
          </Link>
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Remove from comparison"
            >
              ×
            </Button>
          )}
        </div>
      </div>

      {/* Video list */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 space-y-0.5">
        {blocks.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No videos yet in this topic
          </div>
        )}
        {blocks.map((block) => (
          <VideoCard
            key={block.id}
            block={block}
            onClick={() => onSelectBlock(block)}
          />
        ))}
      </div>

      {/* Footer — description teaser */}
      {topic.description && (
        <div className="shrink-0 px-4 py-2.5 border-t border-border/40 bg-background/40">
          <p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
            {topic.description}
          </p>
        </div>
      )}
    </div>
  );
}
