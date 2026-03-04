"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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

// ── Video card ───────────────────────────────────────────────────────────────

function VideoCard({ block, onClick }: { block: CompareBlock; onClick: () => void }) {
  const platform = block.platform as Platform;
  const thumbUrl = getThumbnailUrl(block.videoId, platform, block.thumbnailUrl ?? undefined);
  const displayScore = block.ytViews > 0 ? block.ytViews : Math.max(0, block.likes - block.dislikes);
  const platformLabel = PLATFORM_LABELS[block.platform] ?? block.platform;

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="group w-full flex gap-3 rounded-xl p-2.5 hover:bg-surface h-auto items-start text-left"
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
        {/* Platform badge pinned to thumbnail corner */}
        <div className="absolute bottom-1 left-1">
          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 uppercase tracking-wide bg-black/70 border-white/20 text-white/90 backdrop-blur-sm">
            {platformLabel}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
        {/* Channel / owner name as primary identifier */}
        {block.ownerName && (
          <p className="text-xs font-medium text-foreground/90 truncate leading-tight group-hover:text-accent transition-colors">
            {block.ownerName}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatCount(displayScore)}{" "}
            <span className="opacity-60">{block.ytViews > 0 ? "views" : "score"}</span>
          </span>
          {block.likes > 0 && (
            <span className="text-[11px] text-emerald-500/80 tabular-nums">
              +{block.likes}
            </span>
          )}
          {block.dislikes > 0 && (
            <span className="text-[11px] text-rose-500/70 tabular-nums">
              −{block.dislikes}
            </span>
          )}
        </div>
      </div>
    </Button>
  );
}

// ── Panel header (row 1 of the aligned grid) ─────────────────────────────────

interface PanelHeaderProps {
  panel: ComparePanelData;
  onRemove: () => void;
}

export function ComparePanelHeader({ panel, onRemove }: PanelHeaderProps) {
  const { topic } = panel;

  // Build breadcrumb path from taxonomy or category
  const crumbParts = topic.taxonomyPath
    ? topic.taxonomyPath.split("/").filter(Boolean)
    : topic.category
    ? [topic.category]
    : [];

  return (
    <div className="flex flex-col gap-1 px-4 py-3 border-b border-border/60 bg-background/60 backdrop-blur-sm">
      {/* Row 1 — title + actions */}
      <div className="flex items-start gap-2">
        <h2 className="flex-1 text-sm font-semibold text-foreground leading-snug line-clamp-2 min-w-0">
          {topic.title}
        </h2>
        <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
          <Link
            href={`/t/${topic.slug}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-surface whitespace-nowrap"
          >
            Open ↗
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-7 w-7 text-muted-foreground/50 hover:text-foreground hover:bg-surface"
            title="Remove from comparison"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Row 2 — taxonomy breadcrumbs */}
      <div className="flex items-center gap-1 flex-wrap min-h-[18px]">
        {crumbParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-border text-[10px]">›</span>}
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[18px] shrink-0 lowercase tracking-wide">
              {part}
            </Badge>
          </span>
        ))}
      </div>

      {/* Row 3 — stats */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{topic.videoCount.toLocaleString()} videos</span>
        <span>{formatCount(topic.totalViews)} views</span>
        {topic.totalLikes > 0 && (
          <span className="text-emerald-500/70">+{formatCount(topic.totalLikes)}</span>
        )}
      </div>
    </div>
  );
}

// ── Panel body (row 2 of the aligned grid) ───────────────────────────────────

interface PanelBodyProps {
  panel: ComparePanelData;
  onSelectBlock: (block: CompareBlock) => void;
  className?: string;
}

export function ComparePanelBody({ panel, onSelectBlock, className = "" }: PanelBodyProps) {
  const { topic, blocks } = panel;

  return (
    <div className={`flex flex-col min-h-0 overflow-hidden ${className}`}>
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-0.5">
          {blocks.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No videos yet in this topic
            </div>
          )}
          {blocks.map((block) => (
            <VideoCard key={block.id} block={block} onClick={() => onSelectBlock(block)} />
          ))}
        </div>
      </ScrollArea>

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

// ── Combined panel (kept for backward compat if needed) ──────────────────────

interface ComparePanelProps {
  panel: ComparePanelData;
  onRemove: () => void;
  onSelectBlock: (block: CompareBlock) => void;
  className?: string;
}

export function ComparePanel({ panel, onRemove, onSelectBlock, className = "" }: ComparePanelProps) {
  return (
    <div className={`flex flex-col min-h-0 overflow-hidden ${className}`}>
      <ComparePanelHeader panel={panel} onRemove={onRemove} />
      <ComparePanelBody panel={panel} onSelectBlock={onSelectBlock} />
    </div>
  );
}
