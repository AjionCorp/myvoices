"use client";

import { useState, useRef, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useBlocksStore } from "@/stores/blocks-store";
import { useAuth } from "@/components/auth/AuthProvider";
import { Platform } from "@/lib/constants";
import { getVideoUrl, getThumbnailUrl, getEmbedUrl } from "@/lib/utils/video-url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const isPortrait = block.platform === Platform.YouTubeShort || block.platform === Platform.TikTok;

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
      <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={close}>
        <Card className="w-full max-w-sm gap-3 border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="rounded-md bg-yellow-500/20 text-yellow-400">Sponsored</Badge>
              <span className="text-[11px] text-muted">({block.x}, {block.y}) &middot; Ring {Math.max(Math.abs(block.x), Math.abs(block.y))}</span>
            </div>
            <CloseBtn onClick={close} />
          </div>
          {block.adImageUrl && <img src={block.adImageUrl} alt="Ad" className="mb-3 w-full rounded-lg" />}
          {block.adLinkUrl && (
            <Button asChild className="w-full">
              <a href={block.adLinkUrl} target="_blank" rel="noopener noreferrer">Learn More</a>
            </Button>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm" onClick={close}>
      <div className="flex min-h-full items-center justify-center p-4">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- video area --- */}
        <div className="relative w-full shrink-0 bg-black">
          {embedUrl ? (
            isPortrait ? (
              /* Portrait (Shorts / TikTok): drive size from height so width stays correct */
              <div className="flex w-full justify-center">
                <div style={{ height: "min(55vh, 300px)", width: "calc(min(55vh, 300px) * 9 / 16)", maxWidth: "100%" }}>
                  <iframe
                    src={embedUrl}
                    className="h-full w-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              </div>
            ) : (
              /* Landscape: drive size from width as normal */
              <div className="aspect-video max-h-[50vh] w-full">
                <iframe
                  src={embedUrl}
                  className="h-full w-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )
          ) : thumbnailUrl ? (
            isPortrait ? (
              <div className="flex w-full justify-center">
                <div style={{ height: "min(55vh, 300px)", width: "calc(min(55vh, 300px) * 9 / 16)", maxWidth: "100%" }}>
                  <img src={thumbnailUrl} alt="Thumbnail" className="h-full w-full object-cover" />
                </div>
              </div>
            ) : (
              <img src={thumbnailUrl} alt="Thumbnail" className="aspect-video max-h-[50vh] w-full object-cover" />
            )
          ) : (
            <div className="flex aspect-video max-h-[50vh] w-full items-center justify-center bg-surface-light text-sm text-muted">
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
                  <Badge variant="secondary" className="shrink-0 bg-accent/15 text-[11px] font-bold tabular-nums text-accent-light">
                    #{rank.toLocaleString()}{totalClaimed > 0 && <span className="font-normal text-muted"> / {totalClaimed.toLocaleString()}</span>}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted">
                ({block.x}, {block.y}) &middot; Score {(block.likes - block.dislikes).toLocaleString()} &middot; Ring {Math.max(Math.abs(block.x), Math.abs(block.y))} &middot; {block.platform?.replace("_", " ")}
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <a href={originalUrl} target="_blank" rel="noopener noreferrer">Watch Original</a>
            </Button>
          </div>

          {/* like / dislike / comment toggle */}
          <div className="flex items-center gap-2">
            {/* like */}
            <Button onClick={handleLike}
              variant={liked ? "default" : "secondary"}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
                liked ? "shadow-lg shadow-accent/25" : ""
              } ${likeAnim ? "scale-110" : ""}`}>
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"
                className={`transition-transform duration-200 ${likeAnim ? "scale-125" : ""}`}>
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              <span className="tabular-nums">{block.likes.toLocaleString()}</span>
            </Button>

            {/* dislike */}
            <Button onClick={handleDislike}
              variant={disliked ? "destructive" : "secondary"}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
                disliked ? "text-red-100" : ""
              } ${dislikeAnim ? "scale-110" : ""}`}>
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={disliked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"
                className={`rotate-180 transition-transform duration-200 ${dislikeAnim ? "scale-125" : ""}`}>
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              <span className="tabular-nums">{block.dislikes.toLocaleString()}</span>
            </Button>

            <div className="flex-1" />

            {/* comment toggle */}
            <Button onClick={() => setShowComments(!showComments)}
              variant={showComments ? "default" : "secondary"}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                showComments ? "bg-accent/15 text-accent-light" : "text-muted hover:text-foreground"
              }`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="tabular-nums">{comments.length}</span>
            </Button>
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
                    <Input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Add a comment..."
                      className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                    />
                    <Button
                      onClick={handleComment}
                      disabled={!commentText.trim()}
                      size="sm"
                      className="h-7 shrink-0 text-[11px]">
                      Post
                    </Button>
                  </>
                ) : (
                  <Button onClick={login} variant="ghost" className="w-full py-1 text-xs text-accent-light hover:underline">
                    Sign in to comment
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} variant="ghost" size="icon-sm" className="text-muted hover:text-foreground">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </Button>
  );
}
