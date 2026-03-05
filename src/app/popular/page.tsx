"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/ui/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hotScoreBlock } from "@/lib/utils/hot-score";
import { Flame, Clock, TrendingUp, Eye, ThumbsUp, ThumbsDown } from "lucide-react";

interface PopularBlock {
  id: number;
  topicId: number;
  videoId: string;
  platform: string;
  thumbnailUrl: string | null;
  likes: number;
  dislikes: number;
  ytViews: number;
  ytLikes: number;
  ownerName: string | null;
  claimedAt: number;
}

interface TopicMeta {
  slug: string;
  title: string;
  category: string;
}

type SortMode = "hot" | "top" | "newest";

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

export default function PopularPage() {
  const [blocks, setBlocks] = useState<PopularBlock[]>([]);
  const [topics, setTopics] = useState<Record<number, TopicMeta>>({});
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("hot");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/popular?limit=60");
        if (res.ok) {
          const data = await res.json();
          setBlocks(data.blocks || []);
          setTopics(data.topics || {});
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = [...blocks].sort((a, b) => {
    if (sortMode === "newest") return b.claimedAt - a.claimedAt;
    if (sortMode === "top") {
      const scoreA = Math.max(a.ytViews, a.ytLikes) + (a.likes - a.dislikes);
      const scoreB = Math.max(b.ytViews, b.ytLikes) + (b.likes - b.dislikes);
      return scoreB - scoreA;
    }
    // hot
    return hotScoreBlock(b.likes, b.dislikes, b.ytViews, b.ytLikes, b.claimedAt)
         - hotScoreBlock(a.likes, a.dislikes, a.ytViews, a.ytLikes, a.claimedAt);
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Popular</h1>
            <p className="text-xs text-muted">Trending videos across all topics</p>
          </div>

          <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5">
            {([
              { key: "hot" as const, icon: Flame, label: "Hot" },
              { key: "top" as const, icon: TrendingUp, label: "Top" },
              { key: "newest" as const, icon: Clock, label: "New" },
            ]).map(({ key, icon: Icon, label }) => (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                onClick={() => setSortMode(key)}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortMode === key
                    ? "bg-accent text-white hover:bg-accent hover:text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Icon size={12} /> {label}
              </Button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {!loading && blocks.length === 0 && (
          <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center">
            <p className="text-sm text-muted">No videos yet. Be the first to submit one!</p>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <div className="space-y-2">
            {sorted.map((block, idx) => {
              const topic = topics[block.topicId];
              const thumb = thumbnailFor(block.videoId, block.platform, block.thumbnailUrl);

              return (
                <Link
                  key={block.id}
                  href={topic ? `/t/${topic.slug}` : "/"}
                >
                  <Card className="gap-0 rounded-xl border-border bg-surface py-0 transition-colors hover:bg-surface-light">
                    <CardContent className="flex items-center gap-4 p-3">
                      {/* Rank */}
                      <span className="w-6 shrink-0 text-center text-sm font-bold text-muted">
                        {idx + 1}
                      </span>

                      {/* Thumbnail */}
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
                          {block.platform}
                        </Badge>
                      </div>

                      {/* Info */}
                      <div className="flex flex-1 flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {topic && (
                            <span className="text-xs font-semibold text-accent truncate">
                              {topic.title}
                            </span>
                          )}
                          {topic?.category && (
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              {topic.category}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted truncate">
                          {block.ownerName || "Anonymous"} &middot; {timeAgo(block.claimedAt)}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-muted">
                          {block.ytViews > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Eye size={10} /> {fmt(block.ytViews)}
                            </span>
                          )}
                          {block.likes > 0 && (
                            <span className="flex items-center gap-0.5 text-emerald-500/80">
                              <ThumbsUp size={10} /> {block.likes}
                            </span>
                          )}
                          {block.dislikes > 0 && (
                            <span className="flex items-center gap-0.5 text-rose-500/70">
                              <ThumbsDown size={10} /> {block.dislikes}
                            </span>
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
