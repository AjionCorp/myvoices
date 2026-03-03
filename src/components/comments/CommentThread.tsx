"use client";

import { MessageCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCommentsStore } from "@/stores/comments-store";
import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";

interface Props {
  blockId: number;
}

export function CommentThread({ blockId }: Props) {
  const getTopLevelComments = useCommentsStore((s) => s.getTopLevelComments);
  const topLevel = getTopLevelComments(blockId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageCircle className="h-4 w-4 text-accent" />
        Comments
        {topLevel.length > 0 && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            {topLevel.length}
          </span>
        )}
      </div>

      {/* Composer for new top-level comment */}
      <CommentComposer blockId={blockId} />

      {topLevel.length > 0 && <Separator className="opacity-30" />}

      {/* Comment list */}
      {topLevel.length > 0 ? (
        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-5 pr-3">
            {topLevel.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        </ScrollArea>
      ) : (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No comments yet — be the first!
        </p>
      )}
    </div>
  );
}
