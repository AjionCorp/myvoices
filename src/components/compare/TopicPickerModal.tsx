"use client";

import { useState, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useTopicStore } from "@/stores/topic-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function titleInitials(title: string): string {
  return title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Scope state machine ───────────────────────────────────────────────────────
//
//  category = null              → "choose a category" UI — must pick before searching
//  category set, segment null  → show all topics in that category
//  category set, segment set   → narrow to topics whose taxonomyPath includes segment
//                                (the parent taxonomy node of the originating topic)

const PAGE_SIZE = 10;

type Scope = {
  category: string | null;
  taxonomySegment: string | null;
};

function deriveScope(category?: string | null, taxonomyPath?: string | null): Scope {
  const cat = category?.trim() || null;
  if (!cat) return { category: null, taxonomySegment: null };

  const segments = (taxonomyPath ?? "").split("/").filter(Boolean);

  // Use the topic's own (last) taxonomy segment as the second chip so the
  // label matches exactly where the user is.
  //   "other/miscellaneous/niche-content"  → [other] [niche-content]
  //   "history/military-history"           → [history] [military-history]
  //   "history" (flat)                     → [history]
  const lastSegment = segments.length >= 2 ? segments[segments.length - 1] : null;

  // Skip the segment when it would be redundant with the category chip.
  const taxonomySegment = lastSegment === cat ? null : lastSegment;

  return { category: cat, taxonomySegment };
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TopicPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (slug: string) => void;
  excludeSlugs?: string[];
  title?: string;
  /** Category of the originating topic — drives initial scope. */
  currentTopicCategory?: string | null;
  /** Taxonomy path of the originating topic — drives initial taxonomy segment. */
  currentTopicTaxonomyPath?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TopicPickerModal({
  open,
  onClose,
  onSelect,
  excludeSlugs = [],
  title = "Compare with another topic",
  currentTopicCategory,
  currentTopicTaxonomyPath,
}: TopicPickerModalProps) {
  const topics = useTopicStore((s) => s.topics);

  const [scope, setScope] = useState<Scope>(() =>
    deriveScope(currentTopicCategory, currentTopicTaxonomyPath)
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Derived data ─────────────────────────────────────────────────────────

  const excluded = useMemo(() => new Set(excludeSlugs), [excludeSlugs]);

  const availableTopics = useMemo(
    () => [...topics.values()].filter((t) => t.isActive && !excluded.has(t.slug)),
    [topics, excluded]
  );

  const allCategories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const t of availableTopics) {
      const cat = t.category?.trim() || "other";
      cats.set(cat, (cats.get(cat) ?? 0) + 1);
    }
    return [...cats.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ cat, count }));
  }, [availableTopics]);

  // Categories filtered by search query (when in category-picker mode).
  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allCategories;
    return allCategories.filter(({ cat }) => cat.toLowerCase().includes(q));
  }, [allCategories, search]);

  // Topics filtered by scope + search query (when a category is chosen).
  const filteredTopics = useMemo(() => {
    if (scope.category === null) return [];
    const q = search.toLowerCase().trim();

    return availableTopics
      .filter((t) => {
        if (scope.taxonomySegment) {
          const segs = (t.taxonomyPath ?? "").split("/").filter(Boolean);
          return segs.includes(scope.taxonomySegment);
        }
        return (t.category?.trim() || "other") === scope.category;
      })
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.slug.includes(q) ||
          (t.category ?? "").toLowerCase().includes(q) ||
          (t.taxonomyPath ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => b.totalViews - a.totalViews);
  }, [availableTopics, scope, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTopics.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = filteredTopics.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  // ── Scope chips ──────────────────────────────────────────────────────────

  type Chip = { label: string; onRemove: () => void };
  const chips: Chip[] = [];

  if (scope.category) {
    chips.push({
      label: scope.category,
      onRemove: () => {
        setScope({ category: null, taxonomySegment: null });
        setSearch("");
        setPage(0);
      },
    });
  }
  if (scope.taxonomySegment) {
    chips.push({
      label: scope.taxonomySegment,
      onRemove: () => {
        setScope((s) => ({ ...s, taxonomySegment: null }));
        setSearch("");
        setPage(0);
      },
    });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelect = (slug: string) => {
    onClose();
    onSelect(slug);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) onClose();
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(0);
  };

  const clearSearch = () => {
    setSearch("");
    setPage(0);
    inputRef.current?.focus();
  };

  const selectCategory = (cat: string) => {
    setScope({ category: cat, taxonomySegment: null });
    setSearch("");
    setPage(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isCategoryPicker = scope.category === null;

  const searchPlaceholder = isCategoryPicker
    ? "Search categories…"
    : scope.taxonomySegment
    ? `Search in "${scope.taxonomySegment}"…`
    : `Search in "${scope.category}"…`;

  const subtitleText = isCategoryPicker
    ? `${filteredCategories.length} of ${allCategories.length} categories`
    : search
    ? `${filteredTopics.length} result${filteredTopics.length === 1 ? "" : "s"}`
    : `${filteredTopics.length} topic${filteredTopics.length === 1 ? "" : "s"} · sorted by views`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[88vh]">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="px-5 pt-5 pb-0 shrink-0">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        {/* ── Scope chips (pre-selected filters) ─────────────────────── */}
        {chips.length > 0 && (
          <div className="px-5 pt-2.5 shrink-0 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground/50 shrink-0">Scope:</span>
            {chips.map((chip, i) => (
              <Button
                key={chip.label}
                variant="ghost"
                size="sm"
                onClick={chip.onRemove}
                title={`Remove "${chip.label}" filter — widens the scope`}
                className={`h-auto py-0.5 px-2.5 rounded-full text-[11px] font-medium gap-1.5 border transition-colors group ${
                  i === 0
                    ? "bg-primary/10 border-primary/30 text-primary hover:bg-rose-500/10 hover:border-rose-400/40 hover:text-rose-400"
                    : "bg-accent/10 border-accent/30 text-accent hover:bg-rose-500/10 hover:border-rose-400/40 hover:text-rose-400"
                }`}
              >
                {chip.label}
                <svg
                  className="h-2.5 w-2.5 opacity-50 group-hover:opacity-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            ))}
            <span className="text-[10px] text-muted-foreground/35 ml-0.5">
              click to widen
            </span>
          </div>
        )}

        {/* ── Search bar — always visible ─────────────────────────────── */}
        <div className="px-5 pt-3 pb-1 shrink-0">
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
              ref={inputRef}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
              className="h-10 pl-9 pr-9 text-sm bg-surface-light border-border rounded-xl"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearSearch}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            )}
          </div>
        </div>

        {/* ── CATEGORY PICKER ─────────────────────────────────────────── */}
        {isCategoryPicker && (
          <ScrollArea className="flex-1 min-h-0">
            {filteredCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <p className="text-sm text-muted-foreground">No categories match</p>
                <Button variant="link" size="sm" onClick={clearSearch} className="h-auto p-0 text-xs text-muted-foreground/60">
                  Clear search
                </Button>
              </div>
            ) : (
              <div className="px-4 pt-1 pb-3 grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-1.5">
                {filteredCategories.map(({ cat, count }) => {
                  const grad = pickGradient(cat);
                  return (
                    <Button
                      key={cat}
                      variant="ghost"
                      onClick={() => selectCategory(cat)}
                      className="h-auto flex items-center gap-2.5 px-3 py-2.5 text-left rounded-xl hover:bg-surface border border-border/40 hover:border-border justify-start group transition-colors"
                    >
                      <div className={`shrink-0 w-6 h-6 rounded-md bg-linear-to-br ${grad} flex items-center justify-center`}>
                        <span className="text-[8px] font-bold text-white/90 select-none leading-none">
                          {titleInitials(cat)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate capitalize group-hover:text-accent transition-colors">
                          {cat}
                        </p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {count.toLocaleString()} topic{count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </Button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}

        {/* ── TOPIC LIST ──────────────────────────────────────────────── */}
        {!isCategoryPicker && (
          <ScrollArea className="flex-1 min-h-0">
            {filteredTopics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <svg className="h-8 w-8 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
                </svg>
                <p className="text-sm font-medium text-muted-foreground">No matching topics</p>
                {search ? (
                  <Button variant="link" size="sm" onClick={clearSearch} className="h-auto p-0 text-xs text-muted-foreground/60">
                    Clear search
                  </Button>
                ) : scope.taxonomySegment ? (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setScope((s) => ({ ...s, taxonomySegment: null }))}
                    className="h-auto p-0 text-xs text-muted-foreground/60"
                  >
                    Show all of &quot;{scope.category}&quot;
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="px-3 pb-2 space-y-px">
                {paginated.map((topic) => {
                  const crumbs = topic.taxonomyPath
                    ? topic.taxonomyPath.split("/").filter(Boolean)
                    : [topic.category ?? "other"];
                  const grad = pickGradient(topic.slug);

                  return (
                    <Button
                      key={topic.id}
                      variant="ghost"
                      onClick={() => handleSelect(topic.slug)}
                      className="w-full h-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-left justify-start group"
                    >
                      {/* Avatar */}
                      <div className={`shrink-0 w-9 h-9 rounded-lg bg-linear-to-br ${grad} flex items-center justify-center`}>
                        <span className="text-[11px] font-bold text-white/90 select-none tracking-tight">
                          {titleInitials(topic.title)}
                        </span>
                      </div>

                      {/* 3-row content */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        {/* Row 1 — title */}
                        <p className="text-sm font-medium text-foreground truncate leading-tight group-hover:text-accent transition-colors">
                          {topic.title}
                        </p>

                        {/* Row 2 — taxonomy breadcrumbs */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {crumbs.slice(0, 3).map((crumb, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && <span className="text-border/60 text-[9px]">›</span>}
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 h-[16px] font-normal lowercase tracking-wide border-border/50 ${
                                  crumb === scope.taxonomySegment
                                    ? "bg-accent/10 border-accent/40 text-accent"
                                    : ""
                                }`}
                              >
                                {crumb}
                              </Badge>
                            </span>
                          ))}
                        </div>

                        {/* Row 3 — stats */}
                        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground/70">
                          {topic.videoCount > 0 && (
                            <span>
                              <span className="font-medium text-foreground/70">{topic.videoCount.toLocaleString()}</span>
                              {" vid"}{topic.videoCount === 1 ? "" : "s"}
                            </span>
                          )}
                          {topic.totalViews > 0 && (
                            <>
                              <span className="text-border/60">·</span>
                              <span>
                                <span className="font-medium text-foreground/70">{formatCount(topic.totalViews)}</span>
                                {" views"}
                              </span>
                            </>
                          )}
                          {topic.totalLikes > 0 && (
                            <>
                              <span className="text-border/60">·</span>
                              <span className="flex items-center gap-0.5 text-emerald-500/80">
                                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                </svg>
                                {formatCount(topic.totalLikes)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}

        {/* ── Footer / Pagination ─────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border/40 px-5 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground/60 truncate min-w-0">{subtitleText}</p>

          {/* Pagination controls */}
          {!isCategoryPicker && totalPages > 1 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="h-7 px-2 text-xs"
              >
                ← Prev
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {currentPage + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
                className="h-7 px-2 text-xs"
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
