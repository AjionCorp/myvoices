"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/ui/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getConnection } from "@/lib/spacetimedb/client";
import { useAuthStore } from "@/stores/auth-store";
import { Eye, ThumbsUp, ThumbsDown, Bookmark } from "lucide-react";

interface SavedItem {
  savedId: number;
  blockId: number;
  topicId: number;
  videoId: string;
  platform: string;
  thumbnailUrl: string | null;
  likes: number;
  dislikes: number;
  ytViews: number;
  ownerName: string | null;
  savedAt: number;
  topicTitle: string;
  topicSlug: string;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(microSeconds: number): string {
  const seconds = microSeconds / 1_000_000;
  const now = Date.now() / 1000;
  const diff = now - seconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

function thumbnailFor(videoId: string, platform: string, url: string | null): string {
  if (url) return url;
  if (platform === "youtube") return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  return "";
}

export default function SavedPage() {
  const { isAuthenticated, user } = useAuthStore();
  const userIdentity = user?.identity ?? null;
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = useCallback(() => {
    const conn = getConnection();
    if (!conn || !user?.identity) {
      setLoading(false);
      return;
    }

    const saved: SavedItem[] = [];
    for (const sb of conn.db.saved_block.iter()) {
      if (sb.userIdentity !== user.identity) continue;

      const blockId = Number(sb.blockId);
      const block = conn.db.block.id.find(BigInt(blockId));
      if (!block || block.status !== "claimed") continue;

      const topicId = Number(sb.topicId);
      const topic = conn.db.topic.id.find(BigInt(topicId));

      saved.push({
        savedId: Number(sb.id),
        blockId,
        topicId,
        videoId: block.videoId || "",
        platform: block.platform || "",
        thumbnailUrl: block.thumbnailUrl || null,
        likes: Number(block.likes ?? 0),
        dislikes: Number(block.dislikes ?? 0),
        ytViews: Number(block.ytViews ?? 0),
        ownerName: block.ownerName || null,
        savedAt: Number(sb.createdAt),
        topicTitle: topic?.title || "Unknown Topic",
        topicSlug: topic?.slug || "",
      });
    }

    // Newest saved first
    saved.sort((a, b) => b.savedAt - a.savedAt);
    setItems(saved);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (isAuthenticated && user?.identity) {
      const t = setTimeout(() => {
        const conn = getConnection();
        if (!conn || !user.identity) {
          setLoading(false);
          return;
        }

        const saved: SavedItem[] = [];
        for (const sb of conn.db.saved_block.iter()) {
          if (sb.userIdentity !== user.identity) continue;

          const blockId = Number(sb.blockId);
          const block = conn.db.block.id.find(BigInt(blockId));
          if (!block || block.status !== "claimed") continue;

          const topicId = Number(sb.topicId);
          const topic = conn.db.topic.id.find(BigInt(topicId));

          saved.push({
            savedId: Number(sb.id),
            blockId,
            topicId,
            videoId: block.videoId || "",
            platform: block.platform || "",
            thumbnailUrl: block.thumbnailUrl || null,
            likes: Number(block.likes ?? 0),
            dislikes: Number(block.dislikes ?? 0),
            ytViews: Number(block.ytViews ?? 0),
            ownerName: block.ownerName || null,
            savedAt: Number(sb.createdAt),
            topicTitle: topic?.title || "Unknown Topic",
            topicSlug: topic?.slug || "",
          });
        }

        // Newest saved first
        saved.sort((a, b) => b.savedAt - a.savedAt);
        setItems(saved);
        setLoading(false);
      }, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLoading(false), 0);
    return () => clearTimeout(t);
  }, [isAuthenticated, user?.identity, loadSaved]);

  const handleUnsave = (blockId: number) => {
    const conn = getConnection();
    if (!conn) return;
    conn.reducers.unsaveBlock({ blockId: BigInt(blockId) });
    setItems((prev) => prev.filter((i) => i.blockId !== blockId));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Saved Videos</h1>
          <p className="text-xs text-muted">
            {items.length > 0
              ? `${items.length} saved video${items.length !== 1 ? "s" : ""}`
              : "Videos you bookmark will appear here"}
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {!loading && !isAuthenticated && (
          <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center">
            <p className="text-sm text-muted">Sign in to see your saved videos.</p>
          </div>
        )}

        {!loading && isAuthenticated && items.length === 0 && (
          <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center">
            <Bookmark className="mx-auto mb-3 h-8 w-8 text-muted" />
            <p className="mb-2 text-sm text-muted">No saved videos yet.</p>
            <Link href="/" className="text-sm font-medium text-accent hover:underline">
              Explore topics and save videos you like
            </Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => {
              const thumb = thumbnailFor(item.videoId, item.platform, item.thumbnailUrl);
              return (
                <div key={item.blockId} className="group relative">
                  <Link href={item.topicSlug ? `/t/${item.topicSlug}` : "/"}>
                    <Card className="gap-0 rounded-xl border-border bg-surface py-0 transition-colors hover:bg-surface-light">
                      <CardContent className="flex items-center gap-4 p-3">
                        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-black/30">
                          {thumb ? (
                            <Image
                              src={thumb}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="112px"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted">
                              No thumb
                            </div>
                          )}
                          <Badge
                            variant="outline"
                            className="absolute bottom-1 left-1 border-white/20 bg-black/60 text-[8px] text-white/80 backdrop-blur-sm"
                          >
                            {item.platform}
                          </Badge>
                        </div>

                        <div className="flex flex-1 flex-col gap-1 min-w-0">
                          <span className="text-xs font-semibold text-accent truncate">
                            {item.topicTitle}
                          </span>
                          <p className="text-[11px] text-muted truncate">
                            {item.ownerName || "Anonymous"} &middot; saved {timeAgo(item.savedAt)}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-muted">
                            {item.ytViews > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Eye size={10} /> {fmt(item.ytViews)}
                              </span>
                            )}
                            {item.likes > 0 && (
                              <span className="flex items-center gap-0.5 text-emerald-500/80">
                                <ThumbsUp size={10} /> {item.likes}
                              </span>
                            )}
                            {item.dislikes > 0 && (
                              <span className="flex items-center gap-0.5 text-rose-500/70">
                                <ThumbsDown size={10} /> {item.dislikes}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <button
                    onClick={(e) => { e.preventDefault(); handleUnsave(item.blockId); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-accent opacity-0 transition-opacity hover:bg-surface-light group-hover:opacity-100"
                    title="Unsave"
                  >
                    <Bookmark size={14} fill="currentColor" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
