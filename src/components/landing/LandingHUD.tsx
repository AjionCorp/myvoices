"use client";

import { memo } from "react";
import { Search, Home, X } from "lucide-react";
import type { SortKey } from "@/lib/landing/cluster-layout";
import { ClearableInput } from "@/components/ui/clearable-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  { key: "hot", label: "Hot" },
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
            <ClearableInput
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onClear={() => onSearchChange("")}
              placeholder="Search topics…"
              className="flex-1 border-0 bg-transparent p-0 text-[13px] text-white shadow-none focus-visible:ring-0 placeholder:text-white/35 h-auto [&+button]:text-white/40 [&+button]:hover:text-white/80 [&+button]:hover:bg-transparent"
              style={{ caretColor: "#ea580c" }}
            />
          </div>

          {/* Sort dropdown */}
          <Select value={sortKey} onValueChange={(v) => onSortChange(v as SortKey)}>
            <SelectTrigger
              className="w-auto shrink-0 text-[12px] font-medium text-white/75 focus:ring-0 border-white/10"
              style={{
                background: "rgba(14,14,14,0.90)",
                backdropFilter: "blur(12px)",
                borderRadius: 12,
                padding: "7px 12px",
                height: "auto",
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearCategory}
            title="Clear filter"
            className="h-4 w-4 p-0 rounded-full bg-white/10 text-orange-400 hover:bg-white/20 hover:text-orange-300 shrink-0"
          >
            <X size={9} />
          </Button>
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
          <Button
            key={btn.label}
            variant="ghost"
            size="icon"
            onClick={btn.onClick}
            title={btn.title}
            className="h-9 w-9 text-lg font-semibold text-white/70 hover:text-white hover:bg-white/10"
            style={controlBtnStyle}
          >
            {btn.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="icon"
          onClick={onHome}
          title="Fit all"
          className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
          style={controlBtnStyle}
        >
          <Home size={14} />
        </Button>

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

const controlBtnStyle = {
  background: "rgba(14,14,14,0.90)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
} satisfies React.CSSProperties;

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
