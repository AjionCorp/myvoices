"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTopicStore } from "@/stores/topic-store";
import { useAuth } from "@/components/auth/AuthProvider";
import { TopicCard } from "./TopicCard";

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-surface-light">
      <div className="w-full bg-surface" style={{ aspectRatio: "4/3" }} />
      <div className="space-y-2 px-3 py-3">
        <div className="h-3.5 w-3/4 rounded-md bg-surface" />
        <div className="h-3 w-1/2 rounded-md bg-surface" />
      </div>
    </div>
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
  const { isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [ready, setReady] = useState(false);

  // Mark ready after first non-empty sync via useEffect (safe pattern)
  useEffect(() => {
    if (topics.size > 0) setReady(true);
  }, [topics.size]);

  const { categories, sorted } = useMemo(() => {
    const all = [...topics.values()]
      .filter((t) => t.isActive)
      .sort((a, b) => b.totalViews - a.totalViews || b.createdAt - a.createdAt);

    const cats = [
      ALL,
      ...Array.from(new Set(all.map((t) => t.category || "General"))),
    ];

    const filtered =
      activeCategory === ALL
        ? all
        : all.filter((t) => (t.category || "General") === activeCategory);

    return { categories: cats, sorted: filtered };
  }, [topics, activeCategory]);

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
          <Link
            href="/t/create"
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-light"
          >
            Create First Topic
          </Link>
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
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
              style={
                activeCategory === cat
                  ? { background: "#6d28d9", color: "#fff" }
                  : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }
              }
            >
              {cat}
            </button>
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
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
