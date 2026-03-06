"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Topic } from "@/stores/topic-store";
import { useTopicStore } from "@/stores/topic-store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface TopicCardProps {
  topic: Topic;
  thumbnailUrl?: string;
}

// Inline styles — not Tailwind class strings, so they always render
const GRADIENTS: [string, string][] = [
  ["#7c3aed", "#1e1b4b"],
  ["#e11d48", "#4c0519"],
  ["#f59e0b", "#431407"],
  ["#059669", "#022c22"],
  ["#0ea5e9", "#082f49"],
  ["#c026d3", "#2e1065"],
  ["#dc2626", "#3b0a0a"],
  ["#06b6d4", "#082f49"],
];

function pickGradient(seed: string): [string, string] {
  let h = 0;
  for (const c of seed) h = Math.imul(31, h) + c.charCodeAt(0);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

export function TopicCard({ topic, thumbnailUrl }: TopicCardProps) {
  const taxonomyNodes = useTopicStore((s) => s.taxonomyNodes);
  const moderators = useTopicStore((s) => s.moderators);
  const [colorA, colorB] = pickGradient(topic.title);
  const netLikes = topic.totalLikes - topic.totalDislikes;
  const isTrending = topic.totalViews > 100;
  const taxonomyPath =
    topic.taxonomyPath ||
    (topic.taxonomyNodeId ? taxonomyNodes.get(topic.taxonomyNodeId)?.path : undefined) ||
    "";
  const displayCategory =
    topic.taxonomyName ||
    (topic.taxonomyNodeId ? taxonomyNodes.get(topic.taxonomyNodeId)?.name : undefined) ||
    topic.category ||
    "General";
  const moderatorCount = useMemo(
    () => [...moderators.values()].filter((m) => m.topicId === topic.id && m.status === "active").length,
    [moderators, topic.id]
  );

  return (
    <Link
      href={`/t/${topic.slug}`}
      className="group block w-full min-w-0 max-w-80"
      style={{ minWidth: 0, maxWidth: 320 }}
    >
      <Card className="gap-0 overflow-hidden border-border bg-surface-light py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl hover:shadow-black/60">
        {/* Thumbnail area */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: "4/3",
            background: `linear-gradient(135deg, ${colorA} 0%, ${colorB} 100%)`,
          }}
        >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={topic.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          /* Watermark title fallback when no video exists yet */
          <div className="absolute inset-0 flex items-center justify-center p-4 overflow-hidden">
            <span
              className="select-none text-center font-black uppercase leading-none tracking-tight"
              style={{
                fontSize: "clamp(18px, 4vw, 28px)",
                color: "rgba(255,255,255,0.12)",
              }}
            >
              {topic.title}
            </span>
          </div>
        )}

        {/* Bottom scrim */}
        <div
          className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-6"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)" }}
        >
          <span className="text-xs font-semibold text-white/90">
            {topic.videoCount > 0
              ? `${topic.videoCount.toLocaleString()} video${topic.videoCount !== 1 ? "s" : ""}`
              : "No videos yet"}
          </span>
        </div>

        {/* Trending badge */}
        {isTrending && (
          <div className="absolute left-2.5 top-2.5">
            <Badge className="rounded-full bg-accent text-[10px] font-bold text-white">Hot</Badge>
          </div>
        )}
        </div>

        {/* Info */}
        <CardContent className="flex flex-1 flex-col gap-1.5 px-3 py-3">
        <h3 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-accent">
          {topic.title}
        </h3>

        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <Badge
            variant="secondary"
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
          >
            {displayCategory}
          </Badge>
          {taxonomyPath && (
            <span className="truncate text-[10px] text-muted max-w-[120px]">{taxonomyPath.replaceAll("/", " / ")}</span>
          )}
          <span className="ml-auto tabular-nums">
            {topic.totalViews > 0 ? `${topic.totalViews.toLocaleString()} views` : "New"}
          </span>
          {moderatorCount > 0 && <span>{moderatorCount} mod{moderatorCount !== 1 ? "s" : ""}</span>}
          {netLikes > 0 && (
            <span className="text-green-400">+{netLikes.toLocaleString()}</span>
          )}
        </div>
        </CardContent>
      </Card>
    </Link>
  );
}
