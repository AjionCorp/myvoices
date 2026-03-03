"use client";

import { memo } from "react";
import { Search, X, ChevronDown, Home } from "lucide-react";
import type { SortKey } from "@/lib/landing/cluster-layout";

interface GlobalStats {
  topicCount: number;
  videoCount: number;
  viewCount: number;
}

interface LandingHUDProps {
  search: string;
  onSearchChange: (v: string) => void;
  sortKey: SortKey;
  onSortChange: (k: SortKey) => void;
  activeCategory: string | null;
  onClearCategory: () => void;
  globalStats: GlobalStats;
  onHome: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "views", label: "Most Viewed" },
  { key: "videos", label: "Most Videos" },
  { key: "likes", label: "Most Liked" },
  { key: "newest", label: "Newest" },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const LandingHUD = memo(function LandingHUD({
  search,
  onSearchChange,
  sortKey,
  onSortChange,
  activeCategory,
  onClearCategory,
  globalStats,
  onHome,
  zoom,
  onZoomIn,
  onZoomOut,
}: LandingHUDProps) {
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Sort";

  return (
    <>
      {/* ── Top bar ── */}
      <div
        style={{
          position: "fixed",
          top: 68, // below the sticky header (~64px)
          left: 0,
          right: 0,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "10px 16px",
          pointerEvents: "none",
        }}
      >
        {/* Global stats — left */}
        <div
          style={{
            position: "absolute",
            left: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            pointerEvents: "auto",
          }}
        >
          <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(14,14,14,0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "6px 12px",
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
            fontWeight: 500,
            flexShrink: 0,
          }}
          >
            <Stat value={globalStats.topicCount} label="topics" />
            <Sep />
            <Stat value={globalStats.videoCount} label="videos" />
            <Sep />
            <Stat value={globalStats.viewCount} label="views" />
          </div>
        </div>

        {/* Search bar — centre */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "auto",
            maxWidth: 360,
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              background: "rgba(14,14,14,0.90)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12,
              padding: "7px 12px",
              gap: 8,
            }}
          >
            <Search size={14} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search topics…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 13,
                color: "#ffffff",
                caretColor: "#ea580c",
              }}
            />
            {search && (
              <button
                onClick={() => onSearchChange("")}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.4)",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select
              value={sortKey}
              onChange={(e) => onSortChange(e.target.value as SortKey)}
              style={{
                background: "rgba(14,14,14,0.90)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                padding: "7px 28px 7px 12px",
                fontSize: 12,
                color: "rgba(255,255,255,0.75)",
                cursor: "pointer",
                outline: "none",
                appearance: "none",
                WebkitAppearance: "none",
                fontWeight: 500,
              } as React.CSSProperties}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key} style={{ background: "#1e1e1e" }}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              style={{
                position: "absolute",
                right: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(255,255,255,0.4)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* Right side — nothing for now (zoom controls are below) */}
      </div>

      {/* ── Active category filter pill ── */}
      {activeCategory && (
        <div
          style={{
            position: "fixed",
            top: 116,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(234,88,12,0.20)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(234,88,12,0.35)",
            borderRadius: 20,
            padding: "4px 10px 4px 12px",
            fontSize: 12,
            fontWeight: 600,
            color: "#fb923c",
            pointerEvents: "auto",
            cursor: "default",
            userSelect: "none",
          }}
        >
          <span>{activeCategory}</span>
          <button
            onClick={onClearCategory}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "50%",
              width: 16,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#fb923c",
              padding: 0,
            }}
            title="Clear filter"
          >
            <X size={9} />
          </button>
        </div>
      )}

      {/* ── Zoom + home controls — bottom right ── */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 20,
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          pointerEvents: "auto",
        }}
      >
        {[
          { label: "+", onClick: onZoomIn, title: "Zoom in" },
          { label: "−", onClick: onZoomOut, title: "Zoom out" },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={btn.onClick}
            title={btn.title}
            style={controlBtnStyle}
          >
            {btn.label}
          </button>
        ))}
        <button onClick={onHome} title="Fit all" style={controlBtnStyle}>
          <Home size={14} />
        </button>

        {/* Zoom level indicator */}
        <div
          style={{
            background: "rgba(14,14,14,0.8)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: "4px 8px",
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            fontWeight: 600,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </>
  );
});

const controlBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  background: "rgba(14,14,14,0.90)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 600,
  color: "rgba(255,255,255,0.7)",
  cursor: "pointer",
  lineHeight: 1,
  padding: 0,
  transition: "background 0.15s ease, color 0.15s ease",
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>{fmt(value)}</span>
      {" "}
      <span>{label}</span>
    </span>
  );
}

function Sep() {
  return <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>;
}
