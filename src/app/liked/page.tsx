"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/ui/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getConnection } from "@/lib/spacetimedb/client";
import { useAuthStore } from "@/stores/auth-store";
import { Heart, Eye, ThumbsUp, ThumbsDown } from "lucide-react";

interface LikedBlock {
  id: number;
  topicId: number;
  videoId: string;
  platform: string;
  thumbnailUrl: string | null;
  likes: number;
  dislikes: number;
  ytViews: number;
  ownerName: string | null;
  claimedAt: number;
  likedAt: number;
}

interface TopicMeta {
  slug: string;
  title: string;
  category: string;
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

export default function LikedPage() {
  const { isAuthenticated, user } = useAuthStore();
  const [blocks, setBlocks] = useState<LikedBlock[]>([]);
  const [topics, setTopics] = useState<Record<number, TopicMeta>>({});
  const [loading, setLoading] = useState(true);

  const loadLiked = useCallback(async () => {
    const conn = getConnection();
    if (!conn || !user?.identity) {
      setLoading(false);
      return;
    }

    // Get liked block IDs from WS cache
    const likedMap = new Map<number, number>(); // blockId -> likedAt
    for (const lr of conn.db.like_record.iter()) {
      if (lr.userIdentity === user.identity) {
        likedMap.set(Number(lr.blockId), Number(lr.createdAt));
      }
    }

    if (likedMap.size === 0) {
      setBlocks([]);
      setTopics({});
      setLoading(false);
      return;
    }

    try {
      const blockIds = [...likedMap.keys()].join(",");
      const res = await fetch(`/api/v1/liked?blockIds=${blockIds}`);
      if (res.ok) {
        const data = await res.json();
        const enriched: LikedBlock[] = (data.blocks || []).map((b: Record<string, number | string | null>) => ({
          ...b,
          likedAt: likedMap.get(b.id as number) || 0,
        }));
        // Sort by liked time desc
        enriched.sort((a, b) => b.likedAt - a.likedAt);
        setBlocks(enriched);
        setTopics(data.topics || {});
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user?.identity]);

  useEffect(() => {
    if (isAuthenticated && user?.identity) {
      const t = setTimeout(loadLiked, 500);
      return () => clearTimeout(t);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user?.identity, loadLiked]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Liked Videos</h1>
          <p className="text-xs text-muted">
            {blocks.length > 0
              ? `${blocks.length} liked video${blocks.length !== 1 ? "s" : ""}`
              : "Videos you like will appear here"}
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {!loading && !isAuthenticated && (
          <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center">
            <p className="text-sm text-muted">Sign in to see your liked videos.</p>
          </div>
        )}

        {!loading && isAuthenticated && blocks.length === 0 && (
          <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 text-muted" />
            <p className="mb-2 text-sm text-muted">No liked videos yet.</p>
            <Link href="/" className="text-sm font-medium text-accent hover:underline">
              Explore topics and like videos
            </Link>
          </div>
        )}

        {!loading && blocks.length > 0 && (
          <div className="space-y-2">
            {blocks.map((block) => {
              const topic = topics[block.topicId];
              const thumb = thumbnailFor(block.videoId, block.platform, block.thumbnailUrl);
              return (
                <Link key={block.id} href={topic ? `/t/${topic.slug}` : "/"}>
                  <Card className="gap-0 rounded-xl border-border bg-surface py-0 transition-colors hover:bg-surface-light">
                    <CardContent className="flex items-center gap-4 p-3">
                      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-black/30">
                        {thumb ? (
                          <Image src={thumb} alt="" fill className="object-cover" sizes="112px" unoptimized />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted">No thumb</div>
                        )}
                        <Badge
                          variant="outline"
                          className="absolute bottom-1 left-1 border-white/20 bg-black/60 text-[8px] text-white/80 backdrop-blur-sm"
                        >
                          {block.platform}
                        </Badge>
                      </div>
                      <div className="flex flex-1 flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {topic && <span className="text-xs font-semibold text-accent truncate">{topic.title}</span>}
                          {topic?.category && <Badge variant="outline" className="text-[9px] shrink-0">{topic.category}</Badge>}
                        </div>
                        <p className="text-[11px] text-muted truncate">
                          {block.ownerName || "Anonymous"} &middot; liked {timeAgo(block.likedAt)}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-muted">
                          {block.ytViews > 0 && (
                            <span className="flex items-center gap-0.5"><Eye size={10} /> {fmt(block.ytViews)}</span>
                          )}
                          {block.likes > 0 && (
                            <span className="flex items-center gap-0.5 text-emerald-500/80"><ThumbsUp size={10} /> {block.likes}</span>
                          )}
                          {block.dislikes > 0 && (
                            <span className="flex items-center gap-0.5 text-rose-500/70"><ThumbsDown size={10} /> {block.dislikes}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
