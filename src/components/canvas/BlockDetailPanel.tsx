"use client";

import { useState, useRef, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useBlocksStore } from "@/stores/blocks-store";
import { useAuth } from "@/components/auth/AuthProvider";
import { Platform, CENTER_X, CENTER_Y, GRID_COLS } from "@/lib/constants";
import { getVideoUrl, getThumbnailUrl, getEmbedUrl } from "@/lib/utils/video-url";

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function BlockDetailPanel() {
  const selectedBlockId = useCanvasStore((s) => s.selectedBlockId);
  const selectBlock = useCanvasStore((s) => s.selectBlock);
  const block = useBlocksStore((s) => selectedBlockId !== null ? s.blocks.get(selectedBlockId) : undefined);
  const rank = useBlocksStore((s) => selectedBlockId !== null ? s.rankIndex.get(selectedBlockId) : undefined);
  const totalClaimed = useBlocksStore((s) => s.totalClaimed);
  const updateBlockLikes = useBlocksStore((s) => s.updateBlockLikes);
  const updateBlockDislikes = useBlocksStore((s) => s.updateBlockDislikes);
  const rebalanceBlocks = useBlocksStore((s) => s.rebalanceBlocks);
  const { isAuthenticated, user, login } = useAuth();

  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [dislikeAnim, setDislikeAnim] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLiked(false);
    setDisliked(false);
    setShowComments(false);
    setCommentText("");

    if (selectedBlockId !== null) {
      setComments([
        { id: "1", author: "Alex", text: "This is so good! Deserves to win.", timestamp: Date.now() - 3600000 },
        { id: "2", author: "Mira", text: "Voted. Let's get this to the center!", timestamp: Date.now() - 1800000 },
        { id: "3", author: "Jordan", text: "Absolute fire content right here", timestamp: Date.now() - 600000 },
      ]);
    }
  }, [selectedBlockId]);

  useEffect(() => {
    if (showComments) {
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments.length, showComments]);

  if (selectedBlockId === null || !block || block.status === "empty") return null;

  const embedUrl = block.videoId && block.platform ? getEmbedUrl(block.videoId, block.platform) : null;
  const thumbnailUrl = block.videoId && block.platform ? getThumbnailUrl(block.videoId, block.platform) : null;
  const originalUrl = block.videoId && block.platform ? getVideoUrl(block.videoId, block.platform) : "#";

  const handleLike = () => {
    if (!isAuthenticated) { login(); return; }
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 400);
    if (liked) {
      setLiked(false);
      updateBlockLikes(block.id, Math.max(0, block.likes - 1));
    } else {
      setLiked(true);
      if (disliked) {
        setDisliked(false);
        updateBlockDislikes(block.id, Math.max(0, block.dislikes - 1));
      }
      updateBlockLikes(block.id, block.likes + 1);
    }
    rebalanceBlocks();
  };

  const handleDislike = () => {
    if (!isAuthenticated) { login(); return; }
    setDislikeAnim(true);
    setTimeout(() => setDislikeAnim(false), 400);
    if (disliked) {
      setDisliked(false);
      updateBlockDislikes(block.id, Math.max(0, block.dislikes - 1));
    } else {
      setDisliked(true);
      if (liked) {
        setLiked(false);
        updateBlockLikes(block.id, Math.max(0, block.likes - 1));
      }
      updateBlockDislikes(block.id, block.dislikes + 1);
    }
    rebalanceBlocks();
  };

  const handleComment = () => {
    if (!commentText.trim() || !isAuthenticated) return;
    setComments((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        author: user?.displayName || "You",
        text: commentText.trim(),
        timestamp: Date.now(),
      },
    ]);
    setCommentText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleComment();
    }
  };

  const close = () => selectBlock(null);

  if (block.status === "ad") {
    return (
      <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={close}>
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-400">Sponsored</span>
              <span className="text-[11px] text-muted">({block.x - CENTER_X}, {block.y - CENTER_Y}) &middot; Ring {Math.max(Math.abs(block.x - CENTER_X), Math.abs(block.y - CENTER_Y))}</span>
            </div>
            <CloseBtn onClick={close} />
          </div>
          {block.adImageUrl && <img src={block.adImageUrl} alt="Ad" className="mb-3 w-full rounded-lg" />}
          {block.adLinkUrl && (
            <a href={block.adLinkUrl} target="_blank" rel="noopener noreferrer"
              className="block w-full rounded-lg bg-accent py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent-light">
              Learn More
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={close}>
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh" }}
      >
        {/* --- video area --- */}
        <div className="relative w-full shrink-0 bg-black">
          {embedUrl ? (
            <div className="aspect-9/16 max-h-[50vh] w-full">
              <iframe
                src={embedUrl}
                className="h-full w-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          ) : thumbnailUrl ? (
            <img src={thumbnailUrl} alt="Thumbnail" className="aspect-9/16 max-h-[50vh] w-full object-cover" />
          ) : (
            <div className="flex aspect-9/16 max-h-[50vh] w-full items-center justify-center bg-surface-light text-sm text-muted">
              No preview
            </div>
          )}
          <button onClick={close}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>

        {/* --- info + actions --- */}
        <div className="flex flex-col gap-3 p-4">
          {/* owner row */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
              {block.ownerName?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{block.ownerName || "Anonymous"}</p>
                {rank && (
                  <span className="shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-accent-light">
                    #{rank.toLocaleString()}{totalClaimed > 0 && <span className="font-normal text-muted"> / {totalClaimed.toLocaleString()}</span>}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">
                ({block.x - CENTER_X}, {block.y - CENTER_Y}) &middot; Score {(block.likes - block.dislikes).toLocaleString()} &middot; Ring {Math.max(Math.abs(block.x - CENTER_X), Math.abs(block.y - CENTER_Y))} &middot; {block.platform?.replace("_", " ")}
              </p>
            </div>
            <a href={originalUrl} target="_blank" rel="noopener noreferrer"
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-light">
              Watch Original
            </a>
          </div>

          {/* like / dislike / comment toggle */}
          <div className="flex items-center gap-2">
            {/* like */}
            <button onClick={handleLike}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
                liked
                  ? "bg-accent text-white shadow-lg shadow-accent/25"
                  : "bg-surface-light text-foreground hover:bg-surface-light/80"
              } ${likeAnim ? "scale-110" : ""}`}>
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"
                className={`transition-transform duration-200 ${likeAnim ? "scale-125" : ""}`}>
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              <span className="tabular-nums">{block.likes.toLocaleString()}</span>
            </button>

            {/* dislike */}
            <button onClick={handleDislike}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
                disliked
                  ? "bg-red-500/20 text-red-400"
                  : "bg-surface-light text-foreground hover:bg-surface-light/80"
              } ${dislikeAnim ? "scale-110" : ""}`}>
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={disliked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"
                className={`rotate-180 transition-transform duration-200 ${dislikeAnim ? "scale-125" : ""}`}>
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              <span className="tabular-nums">{block.dislikes.toLocaleString()}</span>
            </button>

            <div className="flex-1" />

            {/* comment toggle */}
            <button onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                showComments ? "bg-accent/15 text-accent-light" : "bg-surface-light text-muted hover:text-foreground"
              }`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="tabular-nums">{comments.length}</span>
            </button>
          </div>

          {/* comments section */}
          {showComments && (
            <div className="flex flex-col rounded-xl border border-border bg-background">
              <div className="max-h-48 overflow-y-auto px-3 py-2">
                {comments.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">No comments yet. Be the first!</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {comments.map((c) => (
                      <div key={c.id} className="group flex gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-light text-[10px] font-bold text-muted">
                          {c.author.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-semibold text-foreground">{c.author}</span>
                            <span className="text-[10px] text-muted">{timeAgo(c.timestamp)}</span>
                          </div>
                          <p className="text-xs leading-relaxed text-foreground/80">{c.text}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={commentsEndRef} />
                  </div>
                )}
              </div>

              {/* input */}
              <div className="flex items-center gap-2 border-t border-border px-3 py-2">
                {isAuthenticated ? (
                  <>
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Add a comment..."
                      className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder-muted outline-none"
                    />
                    <button
                      onClick={handleComment}
                      disabled={!commentText.trim()}
                      className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-accent-light disabled:opacity-30">
                      Post
                    </button>
                  </>
                ) : (
                  <button onClick={login} className="w-full py-1 text-center text-xs text-accent-light hover:underline">
                    Sign in to comment
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-muted transition-colors hover:text-foreground">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}
