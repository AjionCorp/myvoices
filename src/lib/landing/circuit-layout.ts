import type { Topic, TopicTaxonomyNode } from "@/stores/topic-store";
import { hotScoreTopic } from "@/lib/utils/hot-score";

// Re-export SortKey so CircuitCanvas doesn't import from cluster-layout
export type { SortKey } from "@/lib/landing/cluster-layout";

// ─── Tile / grid constants ────────────────────────────────────────────────────
export const CATEGORY_TILE_SIZE = 200;
export const TOPIC_TILE_SIZE    = 120;
export const AD_TILE_W          = TOPIC_TILE_SIZE;
export const AD_TILE_H          = TOPIC_TILE_SIZE;

const CELL_GAP   = 10;
export const CELL = TOPIC_TILE_SIZE + CELL_GAP;   // 130 px

// Each category occupies a vertical lane of this many topic columns
export const COLS_PER_SECTION  = 5;
export const SECTION_INNER_W   = COLS_PER_SECTION * CELL;   // 650 px
const SECTION_GUTTER_X         = 64;
export const SECTION_PITCH     = SECTION_INNER_W + SECTION_GUTTER_X; // 714 px

// 5 sections per row → canvas width = 5 × 714 = 3570 px
export const SECTIONS_PER_ROW  = 5;

// ─── FIXED section row pitch ──────────────────────────────────────────────────
// Each section row's Y origin is simply r * SECTION_ROW_PITCH.
// This keeps all 4 category rows reachable at a reasonable zoom level.
// Topics beyond (originY + SECTION_ROW_PITCH - 150) are marked isDeep
// and only rendered when zoom >= DEEP_ZOOM_THRESHOLD (see CircuitCanvas).
export const SECTION_ROW_PITCH = 900;   // px between category row origins

// Row 0 categories → y = 100
// Row 1 categories → y = 1000
// Row 2 categories → y = 1900
// Row 3 categories → y = 2800

// Distance from category tile top to first topic row
export const GRID_TOP_OFFSET = CATEGORY_TILE_SIZE + 28;  // 228 px

// One ad tile per AD_EVERY_N positions in the flat topic+ad stream
const AD_EVERY_N = 20;

// Separator height: thin horizontal rule between subcategory groups
const SEP_H = 22;

// ─── Overview bounds ──────────────────────────────────────────────────────────
// Covers the first 2 section rows (10 categories).
// At 1920 × 900 screen: zoom = min(1840/3570, 660/1800) ≈ 0.37
// Category tiles render at ~74 px — clearly readable.
export function computeOverviewBounds(): {
  minX: number; minY: number; maxX: number; maxY: number;
  width: number; height: number; cx: number; cy: number;
} {
  const canvasW = SECTIONS_PER_ROW * SECTION_PITCH;
  const h       = 2 * SECTION_ROW_PITCH;   // 1800 px
  return {
    minX:   0,
    minY:   0,
    maxX:   canvasW,
    maxY:   h,
    width:  canvasW,
    height: h,
    cx:     canvasW / 2,
    cy:     h / 2,
  };
}

// ─── Layout node ─────────────────────────────────────────────────────────────
export type LayoutNodeType = "category" | "topic" | "ad" | "separator";

export interface CircuitLayoutNode {
  type: LayoutNodeType;
  id: string;
  x: number;   // centre x in canvas-space px
  y: number;   // centre y in canvas-space px
  w: number;   // rendered width
  h: number;   // rendered height

  /** True when this node sits below the section row's preview window.
   *  CircuitCanvas hides it when zoom < DEEP_ZOOM_THRESHOLD. */
  isDeep?: boolean;

  // ── category ──
  categoryName?: string;
  topicCount?:   number;
  totalVideos?:  number;
  totalViews?:   number;
  totalNetLikes?: number;

  // ── topic ──
  topic?:          Topic;
  thumbnailUrl?:   string;
  subcategoryName?: string;

  // ── ad ──
  adSlotIndex?:    number;
  adCategoryName?: string;

  // ── separator ──
  separatorLabel?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────
interface CategoryGroup {
  name: string;
  topics: Topic[];
  totalViews: number;
  totalVideos: number;
  totalNetLikes: number;
}

import type { SortKey } from "@/lib/landing/cluster-layout";

function getTopLevel(topic: Topic, nodes: Map<number, TopicTaxonomyNode>): string {
  const path =
    topic.taxonomyPath ||
    (topic.taxonomyNodeId ? nodes.get(topic.taxonomyNodeId)?.path : undefined) ||
    "";
  if (path) return path.split("/")[0] || topic.category || "General";
  return topic.category || "General";
}

function getSubLevel(topic: Topic, nodes: Map<number, TopicTaxonomyNode>): string | null {
  const path =
    topic.taxonomyPath ||
    (topic.taxonomyNodeId ? nodes.get(topic.taxonomyNodeId)?.path : undefined) ||
    "";
  if (!path) return null;
  const parts = path.split("/");
  return parts.length > 1 ? parts[1] : null;
}

function sortTopics(topics: Topic[], sortKey: SortKey): Topic[] {
  return [...topics].sort((a, b) => {
    switch (sortKey) {
      case "hot":
        return hotScoreTopic(b.totalLikes, b.totalDislikes, b.totalViews, b.videoCount, b.createdAt)
             - hotScoreTopic(a.totalLikes, a.totalDislikes, a.totalViews, a.videoCount, a.createdAt);
      case "views":
        return b.totalViews - a.totalViews || b.createdAt - a.createdAt;
      case "videos":
        return b.videoCount - a.videoCount || b.totalViews - a.totalViews;
      case "newest":
        return b.createdAt - a.createdAt;
      case "likes":
        return (b.totalLikes - b.totalDislikes) - (a.totalLikes - a.totalDislikes) ||
               b.totalViews - a.totalViews;
    }
  });
}

// ─── Main layout function ─────────────────────────────────────────────────────
export function computeCircuitLayout(
  topics: Map<number, Topic>,
  taxonomyNodes: Map<number, TopicTaxonomyNode>,
  thumbnails: Map<number, string>,
  sortKey: SortKey = "hot",
): CircuitLayoutNode[] {

  const activeTopics = [...topics.values()].filter((t) => t.isActive);

  // ── Group by top-level category ──────────────────────────────────────────
  const groupMap = new Map<string, CategoryGroup>();
  for (const topic of activeTopics) {
    const cat = getTopLevel(topic, taxonomyNodes);
    if (!groupMap.has(cat)) {
      groupMap.set(cat, {
        name: cat, topics: [],
        totalViews: 0, totalVideos: 0, totalNetLikes: 0,
      });
    }
    const g = groupMap.get(cat)!;
    g.topics.push(topic);
    g.totalViews    += topic.totalViews;
    g.totalVideos   += topic.videoCount;
    g.totalNetLikes += topic.totalLikes - topic.totalDislikes;
  }

  // Sort categories by total views descending (most popular first)
  const groups = [...groupMap.values()].sort(
    (a, b) => b.totalViews - a.totalViews || b.totalVideos - a.totalVideos,
  );

  const sectionRowCount = Math.ceil(groups.length / SECTIONS_PER_ROW);

  // ── FIXED row origins: r * SECTION_ROW_PITCH ──────────────────────────────
  // This keeps all category tiles within a predictable, reachable Y range
  // regardless of how many topics each category contains.
  const rowOriginY = Array.from({ length: sectionRowCount }, (_, r) => r * SECTION_ROW_PITCH);

  // ── Place nodes ───────────────────────────────────────────────────────────
  const nodes: CircuitLayoutNode[] = [];
  let adSlotIndex = 0;

  // The Y threshold beyond which a node is considered "deep" (hidden at low zoom)
  // 150 px buffer before the next section row so tiles don't bleed into it visually
  const DEEP_THRESHOLD_OFFSET = SECTION_ROW_PITCH - 150;  // 750 px from originY

  groups.forEach((group, gi) => {
    const sectionRow = Math.floor(gi / SECTIONS_PER_ROW);
    const sectionCol = gi % SECTIONS_PER_ROW;
    const originX    = sectionCol * SECTION_PITCH;
    const originY    = rowOriginY[sectionRow];
    const sectionCx  = originX + SECTION_INNER_W / 2;
    const deepCutY   = originY + DEEP_THRESHOLD_OFFSET;

    // ── Category tile (never deep) ───────────────────────────────────────
    nodes.push({
      type:          "category",
      id:            `cat:${group.name}`,
      x:             sectionCx,
      y:             originY + CATEGORY_TILE_SIZE / 2,
      w:             CATEGORY_TILE_SIZE,
      h:             CATEGORY_TILE_SIZE,
      categoryName:  group.name,
      topicCount:    group.topics.length,
      totalVideos:   group.totalVideos,
      totalViews:    group.totalViews,
      totalNetLikes: group.totalNetLikes,
    });

    // ── Topic + ad flat stream ────────────────────────────────────────────
    const sorted = sortTopics(group.topics, sortKey);

    let cursorY     = originY + GRID_TOP_OFFSET;
    let topicIdx    = 0;
    let absolutePos = 0;
    let prevSubcat: string | null = "__none__";

    while (topicIdx < sorted.length) {
      const rowItems: Array<
        | { kind: "topic"; topic: Topic; subcat: string | null }
        | { kind: "ad" }
      > = [];

      for (let col = 0; col < COLS_PER_SECTION; col++) {
        const isAd = (absolutePos + 1) % AD_EVERY_N === 0;
        if (isAd) {
          rowItems.push({ kind: "ad" });
        } else if (topicIdx < sorted.length) {
          const topic  = sorted[topicIdx];
          const subcat = getSubLevel(topic, taxonomyNodes);
          rowItems.push({ kind: "topic", topic, subcat });
          topicIdx++;
        } else {
          break;
        }
        absolutePos++;
      }

      if (rowItems.length === 0) break;

      // ── Subcategory separator ─────────────────────────────────────────
      const firstTopic = rowItems.find((r) => r.kind === "topic");
      const rowSubcat: string | null = firstTopic?.kind === "topic" ? firstTopic.subcat : prevSubcat;
      if (rowSubcat !== null && rowSubcat !== prevSubcat && prevSubcat !== "__none__") {
        const sepY   = cursorY + SEP_H / 2;
        const isDeep = sepY > deepCutY;
        nodes.push({
          type:           "separator",
          id:             `sep:${group.name}:${rowSubcat}:${cursorY}`,
          x:              sectionCx,
          y:              sepY,
          w:              SECTION_INNER_W,
          h:              SEP_H,
          separatorLabel: rowSubcat,
          isDeep,
        });
        cursorY += SEP_H;
      }
      if (rowSubcat !== null && rowSubcat !== "__none__") prevSubcat = rowSubcat;

      // ── Place tiles in this row ──────────────────────────────────────
      rowItems.forEach((item, col) => {
        const tileX  = originX + col * CELL + TOPIC_TILE_SIZE / 2;
        const tileY  = cursorY + TOPIC_TILE_SIZE / 2;
        const isDeep = tileY > deepCutY;

        if (item.kind === "ad") {
          nodes.push({
            type:           "ad",
            id:             `ad:${group.name}:${adSlotIndex}`,
            x:              tileX,
            y:              tileY,
            w:              AD_TILE_W,
            h:              AD_TILE_H,
            adSlotIndex:    adSlotIndex++,
            adCategoryName: group.name,
            isDeep,
          });
        } else {
          nodes.push({
            type:            "topic",
            id:              `topic:${item.topic.id}`,
            x:               tileX,
            y:               tileY,
            w:               TOPIC_TILE_SIZE,
            h:               TOPIC_TILE_SIZE,
            topic:           item.topic,
            thumbnailUrl:    thumbnails.get(item.topic.id),
            subcategoryName: item.subcat ?? undefined,
            isDeep,
          });
        }
      });

      cursorY += CELL;
    }
  });

  return nodes;
}

// ─── Bounds helpers ───────────────────────────────────────────────────────────
export function computeCircuitBounds(nodes: CircuitLayoutNode[]): {
  minX: number; minY: number; maxX: number; maxY: number;
  width: number; height: number; cx: number; cy: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600, cx: 400, cy: 300 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const hw = n.w / 2;
    const hh = n.h / 2;
    if (n.x - hw < minX) minX = n.x - hw;
    if (n.y - hh < minY) minY = n.y - hh;
    if (n.x + hw > maxX) maxX = n.x + hw;
    if (n.y + hh > maxY) maxY = n.y + hh;
  }
  return {
    minX, minY, maxX, maxY,
    width:  maxX - minX,
    height: maxY - minY,
    cx:    (minX + maxX) / 2,
    cy:    (minY + maxY) / 2,
  };
}
