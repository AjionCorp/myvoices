"use client";

import { memo } from "react";

interface AdTileProps {
  width: number;
  height: number;
  /** Unique monotonically-increasing slot number across the whole canvas */
  adSlotIndex: number;
  /** Category lane this slot belongs to — shown as context when empty */
  categoryName?: string;
  /** Filled-state: ad image URL (from AdPlacement.ad_image_url) */
  adImageUrl?: string | null;
  /** Filled-state: click-through URL (from AdPlacement.ad_link_url) */
  adLinkUrl?: string | null;
  /** Current canvas zoom — gates which labels are visible */
  zoom: number;
}

/**
 * Topic-sized (120×120) ad slot tile.
 *
 * Empty state  → looks like a slightly dimmed topic tile with a tiny amber
 *                corner badge, blending into the grid.
 * Filled state → full-bleed image with an "Ad" badge overlay.
 */
export const AdTile = memo(function AdTile({
  width,
  height,
  adSlotIndex,
  categoryName,
  adImageUrl,
  adLinkUrl,
  zoom,
}: AdTileProps) {
  // ── Filled ad ──────────────────────────────────────────────────────────────
  if (adImageUrl) {
    return (
      <a
        href={adLinkUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display:        "block",
          width,
          height,
          borderRadius:   10,
          overflow:       "hidden",
          border:         "1px solid rgba(251,191,36,0.35)",
          boxShadow:      "0 2px 12px rgba(0,0,0,0.45)",
          flexShrink:     0,
          position:       "relative",
          cursor:         "pointer",
          textDecoration: "none",
        }}
      >
        <img
          src={adImageUrl}
          alt="Sponsored"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
        />
        {/* "Ad" corner badge */}
        <div
          style={{
            position:      "absolute",
            top:           5,
            right:         5,
            background:    "rgba(251,191,36,0.92)",
            borderRadius:  3,
            padding:       "1px 4px",
            fontSize:      8,
            fontWeight:    800,
            color:         "#1a1200",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            lineHeight:    1.4,
          }}
        >
          Ad
        </div>
      </a>
    );
  }

  // ── Empty slot (placeholder) — blends with the topic grid ─────────────────
  const showBadge = zoom >= 0.30;

  return (
    <div
      title={`Ad Slot #${adSlotIndex + 1}${categoryName ? ` — ${categoryName}` : ""}`}
      style={{
        width,
        height,
        borderRadius:  10,
        border:        "1px solid rgba(255,255,255,0.06)",
        background:    "rgba(255,255,255,0.025)",
        flexShrink:    0,
        position:      "relative",
        overflow:      "hidden",
        userSelect:    "none",
        pointerEvents: "none",
      }}
    >
      {/* Subtle inner shimmer — matches the muted look of an unloaded topic tile */}
      <div
        style={{
          position:   "absolute",
          inset:      0,
          background: "linear-gradient(135deg, rgba(255,255,255,0.012) 0%, transparent 60%)",
        }}
      />

      {/* Small amber corner badge — only visible when zoomed in enough */}
      {showBadge && (
        <div
          style={{
            position:      "absolute",
            top:           5,
            right:         5,
            background:    "rgba(251,191,36,0.18)",
            border:        "1px solid rgba(251,191,36,0.30)",
            borderRadius:  3,
            padding:       "1px 4px",
            fontSize:      7,
            fontWeight:    700,
            color:         "rgba(251,191,36,0.65)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            lineHeight:    1.4,
            fontFamily:    "monospace",
          }}
        >
          AD
        </div>
      )}
    </div>
  );
});
