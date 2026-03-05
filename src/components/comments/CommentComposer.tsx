"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getConnection } from "@/lib/spacetimedb/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCommentsStore, type Comment } from "@/stores/comments-store";
import { useAuthStore } from "@/stores/auth-store";

const MAX_CHARS = 280;

interface Props {
  blockId: number;
  parentCommentId?: number;
  repostOfComment?: Comment;
  placeholder?: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function CommentComposer({
  blockId,
  parentCommentId,
  repostOfComment,
  placeholder,
  onSubmitted,
  onCancel,
  autoFocus = false,
}: Props) {
  const { isAuthenticated, login } = useAuth();
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_CHARS - text.length;
  const isOverLimit = remaining < 0;
  const isEmpty = text.trim().length === 0;

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      login();
      return;
    }

    const conn = getConnection();

    setIsSubmitting(true);
    setError(null);

    try {
      if (conn) {
        // Live SpacetimeDB path
        if (repostOfComment) {
          conn.reducers.repostComment({
            blockId: BigInt(blockId),
            originalCommentId: BigInt(repostOfComment.id),
            text: text.trim(),
          });
        } else {
          conn.reducers.addComment({
            blockId: BigInt(blockId),
            text: text.trim(),
            parentCommentId: parentCommentId != null ? BigInt(parentCommentId) : undefined,
          });
        }
      } else {
        // Mock / offline path — write directly into the local store
        const user = useAuthStore.getState().user;
        const userName = user?.displayName || user?.username || "You";
        const userIdentity = user?.identity || "local";
        const newComment: Comment = {
          id: Date.now(),
          blockId,
          userIdentity,
          userName,
          text: text.trim(),
          createdAt: Date.now() * 1000,
          parentCommentId: repostOfComment ? null : (parentCommentId ?? null),
          repostOfId: repostOfComment ? repostOfComment.id : null,
          likesCount: 0,
          repliesCount: 0,
          repostsCount: 0,
          editedAt: 0,
        };
        useCommentsStore.getState().addComment(newComment);

        // Update parent reply count if this is a reply
        if (parentCommentId != null) {
          const parent = useCommentsStore.getState().getComment(parentCommentId);
          if (parent) {
            useCommentsStore.getState().updateComment({
              ...parent,
              repliesCount: parent.repliesCount + 1,
            });
          }
        }
        // Update original repost count
        if (repostOfComment) {
          useCommentsStore.getState().updateComment({
            ...repostOfComment,
            repostsCount: repostOfComment.repostsCount + 1,
          });
        }
      }

      setText("");
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultPlaceholder = repostOfComment
    ? "Add a comment…"
    : parentCommentId
    ? "Post your reply…"
    : "What's on your mind?";

  return (
    <div className="flex flex-col gap-2">
      {repostOfComment && (
        <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium text-foreground/70">{repostOfComment.userName}</span>
          <p className="mt-0.5 line-clamp-2 text-muted-foreground">{repostOfComment.text}</p>
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? defaultPlaceholder}
        className="min-h-[80px] resize-none bg-background/60 text-sm"
        maxLength={MAX_CHARS + 20}
        autoFocus={autoFocus}
        disabled={isSubmitting}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isEmpty && !isOverLimit) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />

      <div className="flex items-center justify-between">
        <span
          className={`text-xs tabular-nums ${
            isOverLimit
              ? "text-destructive"
              : remaining <= 20
              ? "text-amber-500"
              : "text-muted-foreground"
          }`}
        >
          {remaining}
        </span>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
              className="h-7 px-3 text-xs"
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={(!isAuthenticated ? false : isEmpty || isOverLimit) || isSubmitting}
            className="h-7 px-4 text-xs font-semibold"
          >
            {isSubmitting
              ? "Posting…"
              : repostOfComment
              ? "Repost"
              : parentCommentId
              ? "Reply"
              : "Post"}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
