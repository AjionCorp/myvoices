"use client";

import { useState, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useBlocksStore, type Block } from "@/stores/blocks-store";
import { useShallow } from "zustand/react/shallow";
import { useCommentsStore } from "@/stores/comments-store";
import { useAuth } from "@/components/auth/AuthProvider";
import { Platform } from "@/lib/constants";
import { getVideoUrl, getThumbnailUrl, getEmbedUrl, normalizeThumbnailForStorage } from "@/lib/utils/video-url";
import { resolveVideoMeta } from "@/lib/utils/video-meta";
import { getConnection } from "@/lib/spacetimedb/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { CommentThread } from "@/components/comments/CommentThread";

// ---------------------------------------------------------------------------
// Related videos strip
// ---------------------------------------------------------------------------
function RelatedVideos({ topicId, excludeId }: { topicId: number; excludeId: number }) {
  const related = useBlocksStore(
    useShallow((s) => {
      const out: Block[] = [];
      for (const b of s.blocks.values()) {
        if (b.topicId === topicId && b.id !== excludeId && b.status === "claimed" && b.videoId) {
          out.push(b);
          if (out.length === 4) break;
        }
      }
      return out;
    })
  );

  const selectBlock = useCanvasStore((s) => s.selectBlock);

  if (related.length === 0) return null;

  return (
    <div className="border-t border-border/40 px-4 pt-3 pb-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Related
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {related.map((b) => {
          const thumb = b.videoId && b.platform
            ? getThumbnailUrl(b.videoId, b.platform, b.thumbnailUrl)
            : null;
          return (
            <Button
              key={b.id}
              variant="ghost"
              onClick={() => selectBlock(b.id)}
              className="group relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-surface-light p-0 focus-visible:ring-2 focus-visible:ring-accent"
            >
              {thumb ? (
                <img src={thumb} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
              ) : (
                <div className="h-full w-full bg-surface-light" />
              )}
              <div className="absolute inset-0 flex items-end bg-linear-to-t from-black/60 to-transparent p-1">
                <span className="line-clamp-1 text-[9px] text-white/80">{b.ownerName || "—"}</span>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading spinner (shared)
// ---------------------------------------------------------------------------
function Spinner() {
  return (
    <div className="flex items-center gap-2">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" opacity="0.3" />
        <path d="M21 12a9 9 0 00-9-9" />
      </svg>
      Loading video...
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
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
  const [saved, setSaved] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [dislikeAnim, setDislikeAnim] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editUrl, setEditUrl] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEmbedLoading, setIsEmbedLoading] = useState(false);
  const [resolvedEmbedUrl, setResolvedEmbedUrl] = useState<string | null>(null);

  const topLevelCount = useCommentsStore((s) =>
    selectedBlockId != null ? s.getTopLevelComments(selectedBlockId).length : 0
  );

  // Initialize liked/disliked state from SpacetimeDB records
  useEffect(() => {
    setConfirmDelete(false);
    setIsDeleting(false);
    setEditMode(false);
    setEditUrl("");
    setEditError(null);

    if (!selectedBlockId || !user?.identity) {
      setLiked(false);
      setDisliked(false);
      setSaved(false);
      return;
    }

    const conn = getConnection();
    if (!conn) {
      setLiked(false);
      setDisliked(false);
      setSaved(false);
      return;
    }

    let foundLike = false;
    let foundDislike = false;
    let foundSaved = false;
    for (const lr of conn.db.like_record.iter()) {
      if (Number(lr.blockId) === selectedBlockId && lr.userIdentity === user.identity) {
        foundLike = true;
        break;
      }
    }
    for (const dr of conn.db.dislike_record.iter()) {
      if (Number(dr.blockId) === selectedBlockId && dr.userIdentity === user.identity) {
        foundDislike = true;
        break;
      }
    }
    for (const sb of conn.db.saved_block.iter()) {
      if (Number(sb.blockId) === selectedBlockId && sb.userIdentity === user.identity) {
        foundSaved = true;
        break;
      }
    }
    setLiked(foundLike);
    setDisliked(foundDislike);
    setSaved(foundSaved);
  }, [selectedBlockId, user?.identity]);

  const embedUrl = block?.videoId && block?.platform ? getEmbedUrl(block.videoId, block.platform) : null;
  const thumbnailUrl = block?.videoId && block?.platform
    ? getThumbnailUrl(block.videoId, block.platform, block.thumbnailUrl)
    : null;
  const originalUrl = block?.videoId && block?.platform ? getVideoUrl(block.videoId, block.platform) : "#";
  const isPortrait = block?.platform === Platform.YouTubeShort || block?.platform === Platform.TikTok;

  useEffect(() => {
    if (!block || !block.videoId || !block.platform) {
      setResolvedEmbedUrl(null);
      return;
    }

    const needsResolution =
      block.platform === Platform.Rumble ||
      (block.platform === Platform.TikTok && !embedUrl);

    if (!needsResolution) {
      setResolvedEmbedUrl(embedUrl || null);
      return;
    }

    let cancelled = false;
    setResolvedEmbedUrl(null);
    setIsEmbedLoading(true);

    fetch("/api/v1/video-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: originalUrl }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json() as { embedUrl?: string | null };
        return data.embedUrl || null;
      })
      .then((url) => { if (!cancelled) setResolvedEmbedUrl(url); })
      .catch(() => { if (!cancelled) setResolvedEmbedUrl(null); })
      .finally(() => { if (!cancelled) setIsEmbedLoading(false); });

    return () => { cancelled = true; };
  }, [block?.id, block?.platform, block?.videoId, embedUrl, originalUrl]);

  useEffect(() => {
    if (!resolvedEmbedUrl) { setIsEmbedLoading(false); return; }
    setIsEmbedLoading(true);
    const timeout = setTimeout(() => setIsEmbedLoading(false), 8000);
    return () => clearTimeout(timeout);
  }, [resolvedEmbedUrl]);

  if (selectedBlockId === null || !block || block.status === "empty") return null;

  const handleLike = () => {
    if (!isAuthenticated) { login(); return; }
    const conn = getConnection();
    if (!conn) return;
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 400);
    if (liked) {
      conn.reducers.unlikeVideo({ blockId: BigInt(block.id) });
      setLiked(false);
      updateBlockLikes(block.id, Math.max(0, block.likes - 1));
    } else {
      conn.reducers.likeVideo({ blockId: BigInt(block.id) });
      setLiked(true);
      if (disliked) { setDisliked(false); updateBlockDislikes(block.id, Math.max(0, block.dislikes - 1)); }
      updateBlockLikes(block.id, block.likes + 1);
    }
  };

  const handleDislike = () => {
    if (!isAuthenticated) { login(); return; }
    const conn = getConnection();
    if (!conn) return;
    setDislikeAnim(true);
    setTimeout(() => setDislikeAnim(false), 400);
    if (disliked) {
      conn.reducers.undislikeVideo({ blockId: BigInt(block.id) });
      setDisliked(false);
      updateBlockDislikes(block.id, Math.max(0, block.dislikes - 1));
    } else {
      conn.reducers.dislikeVideo({ blockId: BigInt(block.id) });
      setDisliked(true);
      if (liked) { setLiked(false); updateBlockLikes(block.id, Math.max(0, block.likes - 1)); }
      updateBlockDislikes(block.id, block.dislikes + 1);
    }
  };

  const handleSave = () => {
    if (!isAuthenticated) { login(); return; }
    const conn = getConnection();
    if (!conn) return;
    if (saved) {
      conn.reducers.unsaveBlock({ blockId: BigInt(block.id) });
      setSaved(false);
    } else {
      conn.reducers.saveBlock({ blockId: BigInt(block.id) });
      setSaved(true);
    }
  };

  const handleEditSubmit = async () => {
    if (!editUrl.trim()) return;
    const conn = getConnection();
    if (!conn) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const meta = await resolveVideoMeta(editUrl.trim());
      if (!meta) { setEditError("Could not resolve video URL"); return; }
      conn.reducers.editBlock({
        blockId: BigInt(block.id),
        newVideoId: meta.videoId,
        newPlatform: meta.platform,
        newThumbnailUrl: normalizeThumbnailForStorage(meta.thumbnailUrl, meta.platform),
        newYtViews: BigInt(0),
        newYtLikes: BigInt(0),
      });
      setEditMode(false);
      setEditUrl("");
    } catch {
      setEditError("Failed to resolve video");
    } finally {
      setEditSubmitting(false);
    }
  };

  const isOwner = isAuthenticated && !!user?.identity && user.identity === block?.ownerIdentity;

  // Check if user is a topic moderator/owner for this block's topic
  const isMod = (() => {
    if (!isAuthenticated || !user?.identity || !block) return false;
    const conn = getConnection();
    if (!conn) return false;
    // Check topic owner
    const topic = conn.db.topic.id.find(BigInt(block.topicId));
    if (topic && topic.creatorIdentity === user.identity) return true;
    // Check topic moderator
    for (const m of conn.db.topic_moderator.iter()) {
      if (Number(m.topicId) === block.topicId && m.identity === user.identity) return true;
    }
    return false;
  })();

  const handleModRemove = () => {
    if (!block) return;
    const conn = getConnection();
    if (!conn) return;
    conn.reducers.modRemoveBlock({ blockId: BigInt(block.id) });
    selectBlock(null);
  };

  const handleDelete = async () => {
    if (!block || isDeleting) return;
    setIsDeleting(true);
    try {
      const conn = getConnection();
      if (!conn) throw new Error("Not connected");
      conn.reducers.unclaimBlock({ blockId: BigInt(block.id) });
      selectBlock(null);
    } catch {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const close = () => selectBlock(null);

  // --- Ad variant (unchanged) ---
  if (block.status === "ad") {
    return (
      <Dialog open onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-sm p-5 gap-3">
          <VisuallyHidden><DialogTitle>Sponsored content</DialogTitle></VisuallyHidden>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="rounded-md bg-yellow-500/20 text-yellow-400">Sponsored</Badge>
              <span className="text-[11px] text-muted">({block.x}, {block.y}) &middot; Ring {Math.max(Math.abs(block.x), Math.abs(block.y))}</span>
            </div>
          </div>
          {block.adImageUrl && <img src={block.adImageUrl} alt="Ad" className="mb-3 w-full rounded-lg" />}
          {block.adLinkUrl && (
            <Button asChild className="w-full">
              <a href={block.adLinkUrl} target="_blank" rel="noopener noreferrer">Learn More</a>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl border-border bg-surface [&>button]:hidden">
        <VisuallyHidden><DialogTitle>Video details</DialogTitle></VisuallyHidden>

        {/* Outer: flex-col — video on top, two columns below */}
        <div className="flex h-full flex-col overflow-hidden">

          {/* ============================================================
              VIDEO — spans full width
          ============================================================ */}
          <div className="relative w-full shrink-0 bg-black">
            {resolvedEmbedUrl ? (
              isPortrait ? (
                <div className="flex w-full justify-center">
                  <div className="relative" style={{ height: "min(40vh, 280px)", width: "calc(min(40vh, 280px) * 9 / 16)", maxWidth: "100%" }}>
                    <iframe
                      src={resolvedEmbedUrl}
                      className="h-full w-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      onLoad={() => setIsEmbedLoading(false)}
                    />
                    {isEmbedLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-white/80">
                        <Spinner />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative aspect-video max-h-[45vh] w-full">
                  <iframe
                    src={resolvedEmbedUrl}
                    className="h-full w-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    onLoad={() => setIsEmbedLoading(false)}
                  />
                  {isEmbedLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-white/80">
                      <Spinner />
                    </div>
                  )}
                </div>
              )
            ) : thumbnailUrl ? (
              isPortrait ? (
                <div className="flex w-full justify-center">
                  <div style={{ height: "min(40vh, 280px)", width: "calc(min(40vh, 280px) * 9 / 16)", maxWidth: "100%" }}>
                    <img src={thumbnailUrl} alt="Thumbnail" className="h-full w-full object-cover" />
                  </div>
                </div>
              ) : (
                <img src={thumbnailUrl} alt="Thumbnail" className="aspect-video max-h-[45vh] w-full object-cover" />
              )
            ) : (
              <div className="flex aspect-video max-h-[45vh] w-full items-center justify-center bg-surface-light text-sm text-muted">
                No preview
              </div>
            )}

            {(block.platform === Platform.Rumble || block.platform === Platform.TikTok) && !resolvedEmbedUrl && (
              <div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2 text-center text-xs text-white/85">
                This video cannot be embedded here. Use <span className="font-semibold">Watch Original</span>.
              </div>
            )}

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              className="absolute right-3 top-3 h-8 w-8 rounded-full bg-black/50 text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </Button>
          </div>

          {/* ============================================================
              BOTTOM SECTION — two columns (stacks on mobile)
          ============================================================ */}
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[3fr_2fr]">

            {/* LEFT — meta + actions + related */}
            <div className="flex flex-col overflow-y-auto border-b border-border/40 md:border-b-0 md:border-r md:border-border/40">
              <div className="flex flex-col gap-3 p-4">
                {/* Owner row */}
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

                {/* Like / dislike */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleLike}
                    variant={liked ? "default" : "secondary"}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${liked ? "shadow-lg shadow-accent/25" : ""} ${likeAnim ? "scale-110" : ""}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className={`transition-transform duration-200 ${likeAnim ? "scale-125" : ""}`}>
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                    <span className="tabular-nums">{block.likes.toLocaleString()}</span>
                  </Button>

                  <Button
                    onClick={handleDislike}
                    variant={disliked ? "destructive" : "secondary"}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${disliked ? "text-red-100" : ""} ${dislikeAnim ? "scale-110" : ""}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={disliked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className={`rotate-180 transition-transform duration-200 ${dislikeAnim ? "scale-125" : ""}`}>
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                    </svg>
                    <span className="tabular-nums">{block.dislikes.toLocaleString()}</span>
                  </Button>

                  <div className="flex-1" />

                  {/* Comment count (read-only) */}
                  <div className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="tabular-nums">{topLevelCount}</span>
                  </div>

                  {/* Save/bookmark */}
                  <Button
                    onClick={handleSave}
                    variant="ghost"
                    size="icon-sm"
                    className={`transition-colors ${saved ? "text-accent" : "text-muted hover:text-foreground"}`}
                    title={saved ? "Unsave" : "Save"}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </Button>

                  {/* Edit (owner only) */}
                  {isOwner && (
                    <Button
                      onClick={() => setEditMode(!editMode)}
                      variant="ghost"
                      size="icon-sm"
                      className={`transition-colors ${editMode ? "text-accent" : "text-muted hover:text-foreground"}`}
                      title="Swap video"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </Button>
                  )}

                  {/* Delete (owner only) */}
                  {isOwner && (
                    <Button
                      onClick={() => setConfirmDelete(true)}
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted hover:text-red-400"
                      title="Remove my post"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </Button>
                  )}
                </div>

                {/* Delete confirmation */}
                {confirmDelete && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                    <p className="text-xs text-red-300">Remove your post from the canvas?</p>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        onClick={() => setConfirmDelete(false)}
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted hover:text-foreground"
                        disabled={isDeleting}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleDelete}
                        size="sm"
                        className="h-7 bg-red-600 text-xs text-white hover:bg-red-700"
                        disabled={isDeleting}
                      >
                        {isDeleting ? "Removing…" : "Remove"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Edit video form */}
                {editMode && isOwner && (
                  <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
                    <p className="text-xs font-medium text-accent">Swap video URL (likes will reset)</p>
                    <Input
                      type="text"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="Paste new YouTube / TikTok / BiliBili URL..."
                      className="h-8 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-none"
                      onKeyDown={(e) => { if (e.key === "Enter") handleEditSubmit(); }}
                    />
                    {editError && <p className="text-[11px] text-red-400">{editError}</p>}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => { setEditMode(false); setEditUrl(""); setEditError(null); }}
                        variant="ghost"
                        size="sm"
                        className="h-7 flex-1 text-xs text-muted"
                        disabled={editSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleEditSubmit}
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        disabled={editSubmitting || !editUrl.trim()}
                      >
                        {editSubmitting ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Mod remove (for topic mods/owners who don't own this block) */}
                {isMod && !isOwner && (
                  <Button
                    onClick={handleModRemove}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                    Mod: Remove this video
                  </Button>
                )}
              </div>

              {/* Related videos — pushed to bottom */}
              <div className="mt-auto">
                <RelatedVideos topicId={block.topicId} excludeId={block.id} />
              </div>
            </div>

            {/* RIGHT — comments */}
            <div className="flex min-h-0 flex-col">
              <CommentThread blockId={block.id} className="flex-1 min-h-0" />
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
