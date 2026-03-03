"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { LoginButton } from "@/components/auth/LoginButton";
import { ComparePanel } from "./ComparePanel";
import { TopicPickerModal } from "./TopicPickerModal";
import { getEmbedUrl, getVideoUrl } from "@/lib/utils/video-url";
import { useTopicStore } from "@/stores/topic-store";
import { Platform } from "@/lib/constants";
import type { ComparePanel as ComparePanelData, CompareBlock } from "@/app/api/v1/compare/route";

// Avoid dynamic col-span classes that Tailwind can't detect at build time.
const COL_SPAN: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
};

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

  // Use the in-memory topic store as a fallback for titles when API data is
  // unavailable (e.g. SpacetimeDB HTTP-SQL unreachable on first load).
  const storeTopics = useTopicStore((s) => s.topics);

  const getTitle = useCallback(
    (slug: string) => {
      const fromPanel = panels.find((p) => p.topic.slug === slug)?.topic.title;
      if (fromPanel) return fromPanel;
      for (const t of storeTopics.values()) {
        if (t.slug === slug) return t.title;
      }
      return slug;
    },
    [panels, storeTopics]
  );

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

  const handleSelectBlock = useCallback((block: CompareBlock, topicSlug: string) => {
    setActiveBlock({ block, topicSlug });
  }, []);

  const count = panels.length || slugs.length;
  const gridClass = GRID_CLASSES[count] ?? "grid-cols-2";
  const fullSpan = COL_SPAN[count] ?? "col-span-2";

  const isEmpty = !loading && !error && panels.length === 0;

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
                  {getTitle(slug)}
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

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigator.clipboard?.writeText(window.location.href)}
            title="Copy share link"
          >
            Share ⧉
          </Button>

          <LoginButton />
        </div>
      </div>

      {/* ─── Main grid ──────────────────────────────────────────────── */}
      <div className={`flex-1 grid overflow-hidden divide-x divide-border/50 ${gridClass}`}>
        {/* Loading skeletons — one per slug */}
        {loading && slugs.map((slug) => (
          <div key={slug} className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
            <span className="text-xs opacity-60">{getTitle(slug)}</span>
          </div>
        ))}

        {/* Error state */}
        {error && !loading && (
          <div className={`${fullSpan} flex flex-col items-center justify-center gap-3 px-6 text-center`}>
            <svg className="h-8 w-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm font-medium text-foreground">Could not load comparison</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => router.refresh()} className="mt-1">
              Try again
            </Button>
          </div>
        )}

        {/* Empty state — topics not found or no data returned */}
        {isEmpty && (
          <div className={`${fullSpan} flex flex-col items-center justify-center gap-3 px-6 text-center`}>
            <svg className="h-8 w-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm font-medium text-foreground">No data found</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              These topics could not be loaded from the database. They may not exist or the server may be temporarily unavailable.
            </p>
            <div className="flex gap-2 mt-1">
              <Button variant="outline" size="sm" onClick={() => router.refresh()}>
                Retry
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">← Back to Topics</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Populated panels */}
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
      <VideoEmbedModal
        activeBlock={activeBlock}
        onClose={() => setActiveBlock(null)}
      />
    </div>
  );
}

function VideoEmbedModal({
  activeBlock,
  onClose,
}: {
  activeBlock: ActiveBlock | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={activeBlock !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden rounded-2xl">
        <VisuallyHidden>
          <DialogTitle>
            {activeBlock ? `${activeBlock.block.platform} video` : "Video"}
          </DialogTitle>
        </VisuallyHidden>

        {activeBlock && (() => {
          const { block, topicSlug } = activeBlock;
          const platform = block.platform as Platform;
          const embedUrl = getEmbedUrl(block.videoId, platform);
          const watchUrl = getVideoUrl(block.videoId, platform);
          return (
            <>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    ×
                  </Button>
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
                    <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      Open video in new tab ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Score bar */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/40 text-xs text-muted-foreground">
                {block.ytViews > 0 && <span>{block.ytViews.toLocaleString()} views</span>}
                {block.ytLikes > 0 && <span>{block.ytLikes.toLocaleString()} YT likes</span>}
                {(block.likes > 0 || block.dislikes > 0) && (
                  <span>
                    <span className="text-emerald-500">+{block.likes}</span>
                    {" / "}
                    <span className="text-rose-500">−{block.dislikes}</span>
                    {" community"}
                  </span>
                )}
              </div>
            </>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
