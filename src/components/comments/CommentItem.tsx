"use client";

import { useState } from "react";
import { Heart, MessageCircle, Pencil, Repeat2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCommentsStore, type Comment } from "@/stores/comments-store";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthStore } from "@/stores/auth-store";
import { getConnection } from "@/lib/spacetimedb/client";
import { timeAgo } from "@/lib/utils/time";
import { CommentComposer } from "./CommentComposer";

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
      {initials}
    </div>
  );
}

interface Props {
  comment: Comment;
  depth?: number;
}

export function CommentItem({ comment, depth = 0 }: Props) {
  const { isAuthenticated, user, login } = useAuth();
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [showRepostComposer, setShowRepostComposer] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);

  const getReplies = useCommentsStore((s) => s.getReplies);
  const getComment = useCommentsStore((s) => s.getComment);
  const isLikedByUser = useCommentsStore((s) => s.isLikedByUser);

  const isLiked = user ? isLikedByUser(comment.id, user.identity) : false;
  const replies = getReplies(comment.id);
  const repostSource = comment.repostOfId != null ? getComment(comment.repostOfId) : null;

  const isOwn = user?.identity === comment.userIdentity;

  const handleLike = () => {
    if (!isAuthenticated) { login(); return; }
    const conn = getConnection();
    if (conn) {
      if (isLiked) {
        conn.reducers.unlikeComment({ commentId: BigInt(comment.id) });
      } else {
        conn.reducers.likeComment({ commentId: BigInt(comment.id) });
      }
    } else {
      // Mock path — toggle like locally
      const userIdentity = useAuthStore.getState().user?.identity || "local";
      if (isLiked) {
        // Find and remove the like record
        const { commentLikes } = useCommentsStore.getState();
        for (const [id, like] of commentLikes) {
          if (like.commentId === comment.id && like.userIdentity === userIdentity) {
            useCommentsStore.getState().removeCommentLike(id);
            break;
          }
        }
        useCommentsStore.getState().updateComment({
          ...comment,
          likesCount: Math.max(0, comment.likesCount - 1),
        });
      } else {
        useCommentsStore.getState().addCommentLike({
          id: Date.now(),
          commentId: comment.id,
          userIdentity,
          createdAt: Date.now() * 1000,
        });
        useCommentsStore.getState().updateComment({
          ...comment,
          likesCount: comment.likesCount + 1,
        });
      }
    }
  };

  const handleDelete = () => {
    const conn = getConnection();
    if (conn) {
      conn.reducers.deleteComment({ commentId: BigInt(comment.id) });
    } else {
      useCommentsStore.getState().removeComment(comment.id);
    }
  };

  const handleEdit = () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === comment.text) { setIsEditing(false); return; }
    const conn = getConnection();
    if (conn) {
      conn.reducers.editComment({ commentId: BigInt(comment.id), newText: trimmed });
    }
    setIsEditing(false);
  };

  return (
    <div className={`flex gap-3 ${depth > 0 ? "pl-4 border-l border-border/40" : ""}`}>
      <Avatar name={comment.userName} />

      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-sm font-semibold text-foreground">{comment.userName}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
        </div>

        {/* Repost attribution */}
        {comment.repostOfId != null && repostSource && (
          <div className="mt-1 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm">
            <span className="font-medium text-foreground/70">{repostSource.userName}</span>
            <p className="mt-0.5 text-muted-foreground">{repostSource.text}</p>
          </div>
        )}

        {/* Body */}
        {isEditing ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={280}
              rows={2}
              autoFocus
              className="resize-none bg-surface text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(); } if (e.key === "Escape") setIsEditing(false); }}
            />
            <div className="flex gap-1.5">
              <Button size="sm" variant="default" className="h-6 text-xs" onClick={handleEdit}>Save</Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setIsEditing(false); setEditText(comment.text); }}>Cancel</Button>
            </div>
          </div>
        ) : comment.text ? (
          <p className="mt-1 text-sm leading-relaxed text-foreground/90 wrap-break-word">
            {comment.text}
            {comment.editedAt > 0 && <span className="ml-1.5 text-xs text-muted-foreground">(edited)</span>}
          </p>
        ) : null}

        {/* Action bar */}
        <div className="mt-2 flex items-center gap-1 -ml-1.5">
          {/* Like */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={`group h-auto gap-1 rounded-full px-2 py-1 text-xs hover:bg-rose-500/10 hover:text-rose-500 ${
              isLiked ? "text-rose-500" : "text-muted-foreground"
            }`}
            title={isLiked ? "Unlike" : "Like"}
          >
            <Heart
              className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${
                isLiked ? "fill-current" : ""
              }`}
            />
            {comment.likesCount > 0 && <span>{comment.likesCount}</span>}
          </Button>

          {/* Reply — only for non-reposts, non-deep threads */}
          {depth < 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!isAuthenticated) { login(); return; }
                setShowReplyComposer((v) => !v);
                setShowRepostComposer(false);
              }}
              className="group h-auto gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-sky-500/10 hover:text-sky-500"
              title="Reply"
            >
              <MessageCircle className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
              {comment.repliesCount > 0 && <span>{comment.repliesCount}</span>}
            </Button>
          )}

          {/* Repost */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!isAuthenticated) { login(); return; }
              setShowRepostComposer((v) => !v);
              setShowReplyComposer(false);
            }}
            className={`group h-auto gap-1 rounded-full px-2 py-1 text-xs hover:bg-emerald-500/10 hover:text-emerald-500 ${
              showRepostComposer ? "text-emerald-500" : "text-muted-foreground"
            }`}
            title="Repost"
          >
            <Repeat2 className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            {comment.repostsCount > 0 && <span>{comment.repostsCount}</span>}
          </Button>

          {/* Edit (own comments) */}
          {isOwn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEditText(comment.text); setIsEditing(true); }}
              className="ml-auto h-auto rounded-full p-1 text-muted-foreground/50 hover:bg-accent/10 hover:text-accent"
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {/* Delete (own comments) */}
          {isOwn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-auto rounded-full p-1 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Reply composer */}
        {showReplyComposer && (
          <div className="mt-2">
            <CommentComposer
              blockId={comment.blockId}
              parentCommentId={comment.id}
              autoFocus
              onSubmitted={() => {
                setShowReplyComposer(false);
                setShowReplies(true);
              }}
              onCancel={() => setShowReplyComposer(false)}
            />
          </div>
        )}

        {/* Repost composer */}
        {showRepostComposer && (
          <div className="mt-2">
            <CommentComposer
              blockId={comment.blockId}
              repostOfComment={comment}
              autoFocus
              onSubmitted={() => setShowRepostComposer(false)}
              onCancel={() => setShowRepostComposer(false)}
            />
          </div>
        )}

        {/* Replies toggle + thread */}
        {replies.length > 0 && depth < 3 && (
          <div className="mt-2">
            <Button
              variant="link"
              size="sm"
              onClick={() => setShowReplies((v) => !v)}
              className="h-auto p-0 text-xs font-medium text-accent"
            >
              {showReplies ? "Hide replies" : `View ${replies.length} repl${replies.length === 1 ? "y" : "ies"}`}
            </Button>

            {showReplies && (
              <div className="mt-3 flex flex-col gap-4">
                {replies.map((reply) => (
                  <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
