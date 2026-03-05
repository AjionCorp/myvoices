"use client";

import { useState } from "react";
import { MessageCircle, Flame, Clock, TrendingUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useCommentsStore, type Comment } from "@/stores/comments-store";
import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";
import { cn } from "@/lib/utils";

type CommentSort = "hot" | "new" | "top";

function sortComments(comments: Comment[], sortMode: CommentSort): Comment[] {
  return [...comments].sort((a, b) => {
    switch (sortMode) {
      case "new":
        return b.createdAt - a.createdAt;
      case "top":
        return b.likesCount - a.likesCount || b.createdAt - a.createdAt;
      case "hot": {
        // Simple hot: likes + recency bonus
        const ageA = (Date.now() * 1000 - a.createdAt) / 1_000_000 / 3600; // hours
        const ageB = (Date.now() * 1000 - b.createdAt) / 1_000_000 / 3600;
        const hotA = a.likesCount + Math.max(0, 5 - ageA * 0.2);
        const hotB = b.likesCount + Math.max(0, 5 - ageB * 0.2);
        return hotB - hotA;
      }
    }
  });
}

interface Props {
  blockId: number;
  className?: string;
}

export function CommentThread({ blockId, className }: Props) {
  const [sortMode, setSortMode] = useState<CommentSort>("hot");
  const getTopLevelComments = useCommentsStore((s) => s.getTopLevelComments);
  const topLevel = sortComments(getTopLevelComments(blockId), sortMode);

  const SORT_TABS: { key: CommentSort; icon: typeof Flame; label: string }[] = [
    { key: "hot", icon: Flame, label: "Hot" },
    { key: "new", icon: Clock, label: "New" },
    { key: "top", icon: TrendingUp, label: "Top" },
  ];

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header + sort + composer */}
      <div className="shrink-0 border-b border-border/40 px-4 pt-4 pb-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageCircle className="h-4 w-4 text-accent" />
          Comments
          {topLevel.length > 0 && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              {topLevel.length}
            </span>
          )}
          {topLevel.length > 1 && (
            <div className="ml-auto flex gap-0.5 rounded-md border border-border bg-surface p-0.5">
              {SORT_TABS.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setSortMode(key)}
                  className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    sortMode === key
                      ? "bg-accent text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={10} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <CommentComposer blockId={blockId} />
      </div>

      {topLevel.length > 0 && <Separator className="shrink-0 opacity-30" />}

      {/* Scrollable comment list */}
      {topLevel.length > 0 ? (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-5">
            {topLevel.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="text-center text-xs text-muted-foreground">
            No comments yet — be the first!
          </p>
        </div>
      )}
    </div>
  );
}
