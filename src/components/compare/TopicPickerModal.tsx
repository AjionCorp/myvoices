"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTopicStore } from "@/stores/topic-store";

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
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="px-4 pt-3 pb-2">
          <Input
            placeholder="Search by title, category, or taxonomy…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="h-9 text-sm"
          />
        </div>

        <div className="max-h-[360px] overflow-y-auto px-2 pb-3">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No matching topics
            </p>
          )}
          {filtered.map((topic) => {
            const crumb = topic.taxonomyPath
              ? topic.taxonomyPath.split("/").filter(Boolean).join(" › ")
              : topic.category;
            return (
              <button
                key={topic.id}
                onClick={() => handleSelect(topic.slug)}
                className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-surface transition-colors group"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary truncate">
                    {topic.title}
                  </span>
                  {topic.videoCount > 0 && (
                    <Badge variant="outline" className="ml-auto shrink-0 text-[10px] px-1.5 py-0">
                      {topic.videoCount} vid{topic.videoCount === 1 ? "" : "s"}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{crumb}</span>
                  {topic.totalViews > 0 && (
                    <span className="shrink-0 ml-auto">
                      {topic.totalViews.toLocaleString()} views
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
