"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoginButton } from "@/components/auth/LoginButton";
import { ComparePanel } from "./ComparePanel";
import { TopicPickerModal } from "./TopicPickerModal";
import { getEmbedUrl, getVideoUrl } from "@/lib/utils/video-url";
import { Platform } from "@/lib/constants";
import type { ComparePanel as ComparePanelData, CompareBlock } from "@/app/api/v1/compare/route";

// Grid classes indexed by panel count (2, 3, 4)
const GRID_CLASSES: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2",
};

interface CompareViewProps {
  slugs: string[];
  panels: ComparePanelData[];
  loading?: boolean;
  error?: string | null;
}

interface ActiveBlock {
  block: CompareBlock;
  topicSlug: string;
}

export function CompareView({ slugs, panels, loading, error }: CompareViewProps) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeBlock, setActiveBlock] = useState<ActiveBlock | null>(null);

  const handleAddTopic = useCallback(
    (slug: string) => {
      const next = [...slugs, slug].slice(0, 4);
      router.push(`/compare/${next.join("/")}`);
    },
    [slugs, router]
  );

  const handleRemoveTopic = useCallback(
    (slug: string) => {
      const next = slugs.filter((s) => s !== slug);
      if (next.length === 1) {
        router.push(`/t/${next[0]}`);
      } else {
        router.push(`/compare/${next.join("/")}`);
      }
    },
    [slugs, router]
  );

  const handleSelectBlock = useCallback(
    (block: CompareBlock, topicSlug: string) => {
      setActiveBlock({ block, topicSlug });
    },
    []
  );

  const count = panels.length || slugs.length;
  const gridClass = GRID_CLASSES[count] ?? "grid-cols-2";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* ─── Header bar ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-background/80 border-b border-border/60 backdrop-blur-sm z-20">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          ← Topics
        </Link>

        <span className="text-border">/</span>

        <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
            Arena
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {slugs.map((slug, i) => (
              <span key={slug} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-border text-xs">vs</span>}
                <span className="text-sm font-semibold text-foreground truncate max-w-[140px]">
                  {panels.find((p) => p.topic.slug === slug)?.topic.title ?? slug}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {slugs.length < 4 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              className="h-7 px-3 text-xs"
            >
              + Add Topic
            </Button>
          )}

          {/* Share: copy URL */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
            }}
            title="Copy share link"
          >
            Share ⧉
          </Button>

          <LoginButton />
        </div>
      </div>

      {/* ─── Main grid ──────────────────────────────────────────────── */}
      <div className={`flex-1 grid overflow-hidden divide-x divide-border/50 ${gridClass}`}>
        {loading && (
          <>
            {slugs.map((slug) => (
              <div key={slug} className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
                <span className="text-xs">{slug}</span>
              </div>
            ))}
          </>
        )}

        {error && !loading && (
          <div className={`col-span-${count} flex items-center justify-center text-sm text-destructive`}>
            {error}
          </div>
        )}

        {!loading && !error && panels.map((panel, i) => (
          <ComparePanel
            key={panel.topic.slug}
            panel={panel}
            canRemove={slugs.length > 2}
            onRemove={() => handleRemoveTopic(panel.topic.slug)}
            onSelectBlock={(block) => handleSelectBlock(block, panel.topic.slug)}
            className={count === 4 && i >= 2 ? "border-t border-border/50" : ""}
          />
        ))}
      </div>

      {/* ─── Topic picker modal ──────────────────────────────────────── */}
      <TopicPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAddTopic}
        excludeSlugs={slugs}
        title={`Add a ${slugs.length + 1}${slugs.length === 1 ? "nd" : slugs.length === 2 ? "rd" : "th"} Topic`}
      />

      {/* ─── Video embed modal ───────────────────────────────────────── */}
      {activeBlock && (
        <VideoEmbedModal
          block={activeBlock.block}
          topicSlug={activeBlock.topicSlug}
          onClose={() => setActiveBlock(null)}
        />
      )}
    </div>
  );
}

function VideoEmbedModal({
  block,
  topicSlug,
  onClose,
}: {
  block: CompareBlock;
  topicSlug: string;
  onClose: () => void;
}) {
  const platform = block.platform as Platform;
  const embedUrl = getEmbedUrl(block.videoId, platform);
  const watchUrl = getVideoUrl(block.videoId, platform);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-background rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="uppercase tracking-wide font-medium">{block.platform}</span>
            {block.ownerName && (
              <>
                <span className="text-border">·</span>
                <span>{block.ownerName}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-surface"
            >
              Watch externally ↗
            </a>
            <Link
              href={`/t/${topicSlug}`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-surface"
              onClick={onClose}
            >
              View in topic ↗
            </Link>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 text-base leading-none rounded-md hover:bg-surface"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Embed area */}
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video embed"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Open video in new tab ↗
              </a>
            </div>
          )}
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/40 text-xs text-muted-foreground">
          {block.ytViews > 0 && (
            <span>{block.ytViews.toLocaleString()} views</span>
          )}
          {block.ytLikes > 0 && (
            <span>{block.ytLikes.toLocaleString()} YT likes</span>
          )}
          {(block.likes > 0 || block.dislikes > 0) && (
            <span>
              <span className="text-emerald-500">+{block.likes}</span>
              {" / "}
              <span className="text-rose-500">−{block.dislikes}</span>
              {" community"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
