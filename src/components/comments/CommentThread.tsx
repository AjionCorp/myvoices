"use client";

import { MessageCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useCommentsStore } from "@/stores/comments-store";
import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";
import { cn } from "@/lib/utils";

interface Props {
  blockId: number;
  className?: string;
}

export function CommentThread({ blockId, className }: Props) {
  const getTopLevelComments = useCommentsStore((s) => s.getTopLevelComments);
  const topLevel = getTopLevelComments(blockId);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header + composer — fixed, not scrolling */}
      <div className="shrink-0 border-b border-border/40 px-4 pt-4 pb-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageCircle className="h-4 w-4 text-accent" />
          Comments
          {topLevel.length > 0 && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              {topLevel.length}
            </span>
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
