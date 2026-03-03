import type { Topic, TopicTaxonomyNode } from "@/stores/topic-store";

export const CATEGORY_TILE_SIZE = 200;
export const TOPIC_TILE_SIZE = 120;

// Phyllotaxis (sunflower) spiral constant — golden angle in radians
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Scale controls how spread apart topics are around the category anchor.
// radius = PHYTO_SCALE * sqrt(index + 1). First topic sits ~PHYTO_SCALE px away.
const PHYTO_SCALE = 148;

// Distance between category anchor centres
const CLUSTER_SPREAD_X = 960;
const CLUSTER_SPREAD_Y = 880;

// How many category anchors per row
const CATS_PER_ROW = 3;

export type SortKey = "views" | "videos" | "newest" | "likes";

export interface LayoutNode {
  type: "category" | "topic";
  id: string; // "cat:{name}" | "topic:{id}"
  x: number; // centre x in canvas-space pixels
  y: number; // centre y in canvas-space pixels
  // category-specific
  categoryName?: string;
  topicCount?: number;
  totalVideos?: number;
  totalViews?: number;
  totalNetLikes?: number;
  // topic-specific
  topic?: Topic;
  thumbnailUrl?: string;
  subcategoryName?: string;
}

interface CategoryGroup {
  name: string;
  topics: Topic[];
  totalViews: number;
  totalVideos: number;
  totalNetLikes: number;
}

function phyllotaxisOffset(index: number): { x: number; y: number } {
  const r = PHYTO_SCALE * Math.sqrt(index + 1);
  const theta = index * GOLDEN_ANGLE;
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

function getTopLevel(topic: Topic, taxonomyNodes: Map<number, TopicTaxonomyNode>): string {
  const path =
    topic.taxonomyPath ||
    (topic.taxonomyNodeId ? taxonomyNodes.get(topic.taxonomyNodeId)?.path : undefined) ||
    "";
  if (path) return path.split("/")[0] || topic.category || "General";
  return topic.category || "General";
}

function getSubLevel(topic: Topic, taxonomyNodes: Map<number, TopicTaxonomyNode>): string | null {
  const path =
    topic.taxonomyPath ||
    (topic.taxonomyNodeId ? taxonomyNodes.get(topic.taxonomyNodeId)?.path : undefined) ||
    "";
  if (!path) return null;
  const parts = path.split("/");
  return parts.length > 1 ? parts[1] : null;
}

function sortTopics(topics: Topic[], sortKey: SortKey): Topic[] {
  return [...topics].sort((a, b) => {
    switch (sortKey) {
      case "views":
        return b.totalViews - a.totalViews || b.createdAt - a.createdAt;
      case "videos":
        return b.videoCount - a.videoCount || b.totalViews - a.totalViews;
      case "newest":
        return b.createdAt - a.createdAt;
      case "likes":
        return (b.totalLikes - b.totalDislikes) - (a.totalLikes - a.totalDislikes) || b.totalViews - a.totalViews;
    }
  });
}

export function computeLayout(
  topics: Map<number, Topic>,
  taxonomyNodes: Map<number, TopicTaxonomyNode>,
  thumbnails: Map<number, string>,
  sortKey: SortKey = "views",
): LayoutNode[] {
  const activeTopics = [...topics.values()].filter((t) => t.isActive);

  // Group topics by top-level category
  const groupMap = new Map<string, CategoryGroup>();
  for (const topic of activeTopics) {
    const cat = getTopLevel(topic, taxonomyNodes);
    if (!groupMap.has(cat)) {
      groupMap.set(cat, { name: cat, topics: [], totalViews: 0, totalVideos: 0, totalNetLikes: 0 });
    }
    const g = groupMap.get(cat)!;
    g.topics.push(topic);
    g.totalViews += topic.totalViews;
    g.totalVideos += topic.videoCount;
    g.totalNetLikes += topic.totalLikes - topic.totalDislikes;
  }

  // Sort categories by total views descending
  const groups = [...groupMap.values()].sort((a, b) => b.totalViews - a.totalViews || b.totalVideos - a.totalVideos);

  const nodes: LayoutNode[] = [];

  groups.forEach((group, catIndex) => {
    const col = catIndex % CATS_PER_ROW;
    const row = Math.floor(catIndex / CATS_PER_ROW);
    // Hex-offset alternating rows for visual interest
    const hexOffsetX = row % 2 === 1 ? CLUSTER_SPREAD_X * 0.5 : 0;

    const cx = col * CLUSTER_SPREAD_X + hexOffsetX;
    const cy = row * CLUSTER_SPREAD_Y;

    // Category anchor node
    nodes.push({
      type: "category",
      id: `cat:${group.name}`,
      x: cx,
      y: cy,
      categoryName: group.name,
      topicCount: group.topics.length,
      totalVideos: group.totalVideos,
      totalViews: group.totalViews,
      totalNetLikes: group.totalNetLikes,
    });

    // Topic nodes arranged in phyllotaxis spiral around category centre
    const sorted = sortTopics(group.topics, sortKey);
    sorted.forEach((topic, i) => {
      const off = phyllotaxisOffset(i);
      nodes.push({
        type: "topic",
        id: `topic:${topic.id}`,
        x: cx + off.x,
        y: cy + off.y,
        topic,
        thumbnailUrl: thumbnails.get(topic.id),
        subcategoryName: getSubLevel(topic, taxonomyNodes) ?? undefined,
      });
    });
  });

  return nodes;
}

/**
 * Computes the bounding box of all nodes so the initial viewport can fit everything.
 */
export function computeBounds(nodes: LayoutNode[]): {
  minX: number; minY: number; maxX: number; maxY: number;
  width: number; height: number; cx: number; cy: number;
} {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600, cx: 400, cy: 300 };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const half = n.type === "category" ? CATEGORY_TILE_SIZE / 2 : TOPIC_TILE_SIZE / 2;
    minX = Math.min(minX, n.x - half);
    minY = Math.min(minY, n.y - half);
    maxX = Math.max(maxX, n.x + half);
    maxY = Math.max(maxY, n.y + half);
  }
  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}
