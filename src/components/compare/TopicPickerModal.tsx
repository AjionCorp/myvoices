"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTopicStore } from "@/stores/topic-store";

const GRADIENTS = [
  "from-violet-600 to-indigo-800",
  "from-rose-500 to-pink-800",
  "from-amber-500 to-orange-800",
  "from-emerald-500 to-teal-800",
  "from-sky-500 to-blue-800",
  "from-fuchsia-500 to-purple-800",
  "from-red-500 to-rose-800",
  "from-cyan-500 to-sky-800",
];

function pickGradient(seed: string): string {
  let h = 0;
  for (const c of seed) h = Math.imul(31, h) + c.charCodeAt(0);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

interface TopicPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the selected topic slug. */
  onSelect: (slug: string) => void;
  /** Slugs already in the comparison — these are hidden from the picker. */
  excludeSlugs?: string[];
  title?: string;
}

export function TopicPickerModal({
  open,
  onClose,
  onSelect,
  excludeSlugs = [],
  title = "Add Topic to Compare",
}: TopicPickerModalProps) {
  const [search, setSearch] = useState("");
  const topics = useTopicStore((s) => s.topics);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const excluded = new Set(excludeSlugs);
    return [...topics.values()]
      .filter((t) => t.isActive && !excluded.has(t.slug))
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.slug.includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.taxonomyPath ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 60);
  }, [topics, search, excludeSlugs]);

  const handleSelect = (slug: string) => {
    setSearch("");
    onClose();
    onSelect(slug);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSearch("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 pt-3 pb-3">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
            </svg>
            <Input
              placeholder="Search by title, category, or taxonomy…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="h-10 pl-9 pr-4 text-sm bg-surface-light border-border rounded-xl"
            />
          </div>
        </div>

        {/* List */}
        <ScrollArea className="max-h-[420px]">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-1.5">
              <svg
                className="h-8 w-8 text-muted-foreground/30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
              </svg>
              <p className="text-sm text-muted-foreground">No matching topics</p>
              {search && (
                <p className="text-xs text-muted-foreground/50">Try a different keyword</p>
              )}
            </div>
          ) : (
            <div className="px-2 pb-2 space-y-px">
              {filtered.map((topic) => {
                const crumbs = topic.taxonomyPath
                  ? topic.taxonomyPath.split("/").filter(Boolean)
                  : [topic.category];
                const gradient = pickGradient(topic.slug);
                const initials = topic.title
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase();

                return (
                  <Button
                    key={topic.id}
                    variant="ghost"
                    onClick={() => handleSelect(topic.slug)}
                    className="w-full h-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-left justify-start group"
                  >
                    {/* Color avatar */}
                    <div
                      className={`shrink-0 w-9 h-9 rounded-lg bg-linear-to-br ${gradient} flex items-center justify-center`}
                    >
                      <span className="text-[11px] font-bold text-white/80 select-none">
                        {initials}
                      </span>
                    </div>

                    {/* Title + crumbs */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate leading-tight group-hover:text-accent transition-colors">
                        {topic.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground truncate leading-tight">
                        {crumbs.join(" › ")}
                      </p>
                    </div>

                    {/* Stats — fixed width so they never overflow */}
                    <div className="shrink-0 w-16 text-right">
                      {topic.videoCount > 0 && (
                        <p className="text-xs font-semibold text-foreground leading-tight">
                          {topic.videoCount}
                          <span className="font-normal text-muted-foreground text-[10px]">
                            {" "}vid{topic.videoCount === 1 ? "" : "s"}
                          </span>
                        </p>
                      )}
                      {topic.totalViews > 0 && (
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {formatCount(topic.totalViews)}v
                        </p>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="border-t border-border/40 px-5 py-2.5">
            <p className="text-xs text-muted-foreground/60">
              {filtered.length} topic{filtered.length === 1 ? "" : "s"} · sorted by views
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
