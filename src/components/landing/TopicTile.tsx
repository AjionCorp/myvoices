"use client";

import { memo, useRef } from "react";
import type { Topic } from "@/stores/topic-store";
import { TOPIC_TILE_SIZE } from "@/lib/landing/cluster-layout";

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

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface TopicTileProps {
  topic: Topic;
  thumbnailUrl?: string;
  subcategoryName?: string;
  /** 0..1 — how much this tile is suppressed by search/filter. 0 = fully visible, 1 = fully dimmed */
  dimAmount: number;
  zoom: number;
  /** Whether the pan is actively dragging (controls cursor style) */
  isDragging: boolean;
  /** Navigation callback — provided by LandingCanvas, reads didDragRef synchronously */
  onTopicClick: (slug: string) => void;
}

export const TopicTile = memo(function TopicTile({
  topic,
  thumbnailUrl,
  subcategoryName,
  dimAmount,
  zoom,
  isDragging,
  onTopicClick,
}: TopicTileProps) {
  const [colorA, colorB] = pickGradient(topic.title);
  const netLikes = topic.totalLikes - topic.totalDislikes;
  const isTrending = topic.totalViews > 100;
  const showDetail = zoom >= 0.55;

  // Track the exact position where the pointer went down so we can distinguish
  // a clean tap from a drag that happened to end on this tile.
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    // Do NOT stop propagation — outer container still needs to track drag start
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const start = pointerDownPos.current;
    if (start) {
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8;
      if (moved) return; // was a drag, not a tap
    }
    onTopicClick(topic.slug);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${topic.title} canvas`}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTopicClick(topic.slug); } }}
      style={{
        width: TOPIC_TILE_SIZE,
        height: TOPIC_TILE_SIZE,
        borderRadius: 12,
        overflow: "hidden",
        border: "1.5px solid rgba(255,255,255,0.08)",
        background: `linear-gradient(135deg, ${colorA} 0%, ${colorB} 100%)`,
        position: "relative",
        cursor: isDragging ? "grabbing" : "pointer",
        userSelect: "none",
        flexShrink: 0,
        opacity: 1 - dimAmount * 0.85,
        transform: dimAmount > 0.3 ? "scale(0.92)" : "scale(1)",
        transition: "opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
        boxShadow: dimAmount < 0.1 ? "0 3px 12px rgba(0,0,0,0.45)" : "none",
        willChange: "transform",
        zIndex: 2,
      }}
      onMouseEnter={(e) => {
        if (dimAmount < 0.3) {
          (e.currentTarget as HTMLDivElement).style.transform = "scale(1.06)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.6)";
          (e.currentTarget as HTMLDivElement).style.zIndex = "20";
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.25)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = dimAmount > 0.3 ? "scale(0.92)" : "scale(1)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = dimAmount < 0.1 ? "0 3px 12px rgba(0,0,0,0.45)" : "none";
        (e.currentTarget as HTMLDivElement).style.zIndex = "2";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
      }}
    >
      {/* Thumbnail */}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={topic.title}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
          }}
          loading="lazy"
        />
      )}

      {/* Gradient fallback watermark when no thumbnail */}
      {!thumbnailUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 8,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontSize: "clamp(10px, 3vw, 14px)",
              fontWeight: 900,
              color: "rgba(255,255,255,0.10)",
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              wordBreak: "break-word",
              userSelect: "none",
            }}
          >
            {topic.title}
          </span>
        </div>
      )}

      {/* Bottom scrim — title + video count */}
      <div
        style={{
          position: "absolute",
          inset: "auto 0 0 0",
          background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
          padding: "20px 7px 7px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(255,255,255,0.95)",
            lineHeight: 1.2,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            marginBottom: 3,
          }}
        >
          {topic.title}
        </div>
        {showDetail && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
              {topic.videoCount > 0
                ? `${topic.videoCount.toLocaleString()} vid${topic.videoCount !== 1 ? "s" : ""}`
                : "empty"}
            </span>
            {topic.totalViews > 0 && (
              <>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>·</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)" }}>{fmt(topic.totalViews)}v</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Trending badge — top left */}
      {isTrending && (
        <div
          style={{
            position: "absolute",
            top: 5,
            left: 5,
            background: "#ea580c",
            borderRadius: 6,
            padding: "2px 5px",
            fontSize: 8,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            lineHeight: 1.2,
            zIndex: 3,
          }}
        >
          Hot
        </div>
      )}

      {/* Stats badges — top right */}
      {showDetail && (netLikes > 0 || topic.totalViews > 0) && (
        <div
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
            zIndex: 3,
          }}
        >
          {netLikes > 0 && (
            <div
              style={{
                background: "rgba(34,197,94,0.85)",
                borderRadius: 5,
                padding: "1px 4px",
                fontSize: 8,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1.3,
              }}
            >
              +{fmt(netLikes)}
            </div>
          )}
        </div>
      )}

      {/* Subcategory pill — bottom right overlay on gradient */}
      {showDetail && subcategoryName && (
        <div
          style={{
            position: "absolute",
            bottom: 5,
            right: 5,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 5,
            padding: "1px 4px",
            fontSize: 8,
            fontWeight: 600,
            color: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(4px)",
            maxWidth: 70,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            lineHeight: 1.3,
            zIndex: 3,
          }}
        >
          {subcategoryName}
        </div>
      )}
    </div>
  );
});
