"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTopicStore } from "@/stores/topic-store";
import { useAuth } from "@/components/auth/AuthProvider";
import { getThumbnailUrl } from "@/lib/utils/video-url";
import { Platform } from "@/lib/constants";
import { TopicCard } from "./TopicCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function SkeletonCard() {
  return (
    <Card className="animate-pulse gap-0 overflow-hidden border-border bg-surface-light py-0">
      <div className="w-full bg-surface" style={{ aspectRatio: "4/3" }} />
      <CardContent className="space-y-2 px-3 py-3">
        <div className="h-3.5 w-3/4 rounded-md bg-surface" />
        <div className="h-3 w-1/2 rounded-md bg-surface" />
      </CardContent>
    </Card>
  );
}

const ALL = "All";

// Cards are at least 160px, at most fill available space — auto-responsive
const GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: "12px",
};

export function TopicsLanding() {
  const topics = useTopicStore((s) => s.topics);
  const taxonomyNodes = useTopicStore((s) => s.taxonomyNodes);
  const { isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [activeSubcategory, setActiveSubcategory] = useState(ALL);
  const [ready, setReady] = useState(false);
  const [topVideos, setTopVideos] = useState<Record<number, { videoId: string; platform: string; thumbnailUrl: string | null }>>({});

  // Mark ready after first non-empty sync via useEffect (safe pattern)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (topics.size > 0) setReady(true);
  }, [topics.size]);

  // Re-fetch top video per topic whenever the topics list changes (new topic added, video count changes).
  // This is the only way to get block data on the landing page since blocks aren't in the
  // global WebSocket subscription — they're only subscribed per-topic.
  const topicVideoFingerprint = useMemo(
    () => [...topics.values()].map((t) => `${t.id}:${t.videoCount}`).join(","),
    [topics],
  );

  useEffect(() => {
    if (!topicVideoFingerprint) return;
    fetch("/api/v1/topics")
      .then((r) => r.json())
      .then((d: { topVideos?: Record<number, { videoId: string; platform: string; thumbnailUrl: string | null }> }) => {
        if (d.topVideos) setTopVideos(d.topVideos);
      })
      .catch(() => {/* ignore — thumbnails just won't show */});
  }, [topicVideoFingerprint]);

  /** topicId → thumbnail URL of the most-liked video */
  const topicThumbnails = useMemo(() => {
    const map = new Map<number, string>();
    for (const [idStr, tv] of Object.entries(topVideos)) {
      const url = getThumbnailUrl(tv.videoId, tv.platform as Platform, tv.thumbnailUrl);
      if (url) map.set(Number(idStr), url);
    }
    return map;
  }, [topVideos]);

  const { categories, subcategories, sorted } = useMemo(() => {
    const all = [...topics.values()]
      .filter((t) => t.isActive)
      .sort((a, b) => b.totalViews - a.totalViews || b.createdAt - a.createdAt);

    const getTopLevel = (topic: (typeof all)[number]): string => {
      const taxonomyPath =
        topic.taxonomyPath ||
        (topic.taxonomyNodeId ? taxonomyNodes.get(topic.taxonomyNodeId)?.path : undefined) ||
        "";
      if (taxonomyPath) {
        return taxonomyPath.split("/")[0] || topic.category || "General";
      }
      return topic.category || "General";
    };
    const getSubLevel = (topic: (typeof all)[number]): string | null => {
      const taxonomyPath =
        topic.taxonomyPath ||
        (topic.taxonomyNodeId ? taxonomyNodes.get(topic.taxonomyNodeId)?.path : undefined) ||
        "";
      if (!taxonomyPath) return null;
      const parts = taxonomyPath.split("/");
      return parts.length > 1 ? parts[1] : null;
    };

    const cats = [
      ALL,
      ...Array.from(new Set(all.map((t) => getTopLevel(t) || "General"))),
    ];

    const byTop =
      activeCategory === ALL
        ? all
        : all.filter((t) => getTopLevel(t) === activeCategory);

    const subs = [
      ALL,
      ...Array.from(
        new Set(byTop.map((t) => getSubLevel(t)).filter((s): s is string => !!s))
      ),
    ];
    const filtered =
      activeSubcategory === ALL ? byTop : byTop.filter((t) => getSubLevel(t) === activeSubcategory);

    return { categories: cats, subcategories: subs, sorted: filtered };
  }, [topics, taxonomyNodes, activeCategory, activeSubcategory]);

  // Still connecting — show skeleton
  if (!ready) {
    return (
      <div>
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {[72, 56, 68, 52, 64].map((w, i) => (
            <div
              key={i}
              className="h-8 shrink-0 animate-pulse rounded-full bg-surface-light"
              style={{ width: w }}
            />
          ))}
        </div>
        <div style={GRID_STYLE}>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Connected but genuinely empty
  if (topics.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl text-4xl"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          🎬
        </div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">No topics yet</h2>
        <p className="mb-6 max-w-xs text-sm text-muted">
          Be the first to create a topic and start building a community video grid.
        </p>
        {isAuthenticated && (
          <Button asChild className="rounded-xl">
            <Link href="/t/create">Create First Topic</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Category filter pills — only show when there's more than one category */}
      {categories.length > 2 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <Button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setActiveSubcategory(ALL);
              }}
              size="sm"
              variant={activeCategory === cat ? "default" : "ghost"}
              className={
                activeCategory === cat
                  ? "shrink-0 rounded-full px-3.5 text-xs"
                  : "shrink-0 rounded-full border border-border/60 px-3.5 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {cat}
            </Button>
          ))}
        </div>
      )}

      {activeCategory !== ALL && subcategories.length > 2 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {subcategories.map((sub) => (
            <Button
              key={sub}
              onClick={() => setActiveSubcategory(sub)}
              size="sm"
              variant={activeSubcategory === sub ? "default" : "ghost"}
              className={
                activeSubcategory === sub
                  ? "shrink-0 rounded-full px-3.5 text-xs"
                  : "shrink-0 rounded-full border border-border/60 px-3.5 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {sub}
            </Button>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          No topics in this category yet.
        </p>
      ) : (
        <div style={GRID_STYLE}>
          {sorted.map((topic) => (
            <TopicCard key={topic.id} topic={topic} thumbnailUrl={topicThumbnails.get(topic.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
