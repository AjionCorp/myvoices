"use client";

import { memo, useRef } from "react";
import { CATEGORY_TILE_SIZE } from "@/lib/landing/cluster-layout";

const GRADIENTS: [string, string][] = [
  ["#7c3aed", "#1e1b4b"],
  ["#e11d48", "#4c0519"],
  ["#f59e0b", "#431407"],
  ["#059669", "#022c22"],
  ["#0ea5e9", "#082f49"],
  ["#c026d3", "#2e1065"],
  ["#dc2626", "#3b0a0a"],
  ["#06b6d4", "#082f49"],
  ["#84cc16", "#1a2e05"],
  ["#f97316", "#431407"],
  ["#8b5cf6", "#2e1065"],
  ["#14b8a6", "#022c22"],
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

interface CategoryTileProps {
  name: string;
  topicCount: number;
  totalVideos: number;
  totalViews: number;
  totalNetLikes: number;
  isActive: boolean;
  isFiltered: boolean; // true when some other category is active
  zoom: number;
  onClick: () => void;
}

export const CategoryTile = memo(function CategoryTile({
  name,
  topicCount,
  totalVideos,
  totalViews,
  totalNetLikes,
  isActive,
  isFiltered,
  zoom,
  onClick,
}: CategoryTileProps) {
  const [colorA, colorB] = pickGradient(name);
  const showDetail = zoom >= 0.45;
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Filter by ${name}`}
      onPointerDown={(e) => { pointerDownPos.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => {
        e.stopPropagation();
        const start = pointerDownPos.current;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;
        onClick();
      }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      style={{
        width: CATEGORY_TILE_SIZE,
        height: CATEGORY_TILE_SIZE,
        background: `linear-gradient(135deg, ${colorA} 0%, ${colorB} 100%)`,
        borderRadius: 16,
        border: isActive
          ? `2px solid ${colorA}`
          : "2px solid rgba(255,255,255,0.10)",
        boxShadow: isActive
          ? `0 0 0 3px ${colorA}55, 0 8px 32px rgba(0,0,0,0.5)`
          : "0 4px 20px rgba(0,0,0,0.4)",
        opacity: isFiltered ? 0.35 : 1,
        transform: isFiltered ? "scale(0.92)" : isActive ? "scale(1.04)" : "scale(1)",
        transition: "opacity 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        flexShrink: 0,
        zIndex: isActive ? 10 : 5,
        willChange: "transform",
      }}
    >
      {/* Noise texture overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
          backgroundSize: "150px",
          pointerEvents: "none",
          opacity: 0.6,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 10px 44px",
          gap: 6,
        }}
      >
        {/* Category icon letter */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 800,
            color: "rgba(255,255,255,0.9)",
            flexShrink: 0,
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>

        {/* Category name */}
        <div
          style={{
            fontSize: showDetail ? 15 : 13,
            fontWeight: 800,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            textShadow: "0 1px 4px rgba(0,0,0,0.4)",
            maxWidth: "90%",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {name}
        </div>
      </div>

      {/* Bottom stats strip */}
      <div
        style={{
          position: "absolute",
          inset: "auto 0 0 0",
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
          padding: "18px 10px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {showDetail ? (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600 }}>{topicCount} topic{topicCount !== 1 ? "s" : ""}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{fmt(totalVideos)} video{totalVideos !== 1 ? "s" : ""}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{fmt(totalViews)} views</span>
            {totalNetLikes > 0 && (
              <>
                <span style={{ opacity: 0.5 }}>·</span>
                <span style={{ color: "#86efac" }}>+{fmt(totalNetLikes)}</span>
              </>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
            {topicCount} topic{topicCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Active ring pulse */}
      {isActive && (
        <div
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: 20,
            border: `2px solid ${colorA}88`,
            pointerEvents: "none",
            animation: "pulse-ring 2s ease-out infinite",
          }}
        />
      )}
    </div>
  );
});
