export const TILE_WIDTH = 56;
export const TILE_HEIGHT = 100;
export const TILE_GAP = 1;
export const GRID_COLS = 1250;
export const GRID_ROWS = 800;
export const TOTAL_BLOCKS = GRID_COLS * GRID_ROWS;
export const CENTER_X = Math.floor(GRID_COLS / 2);
export const CENTER_Y = Math.floor(GRID_ROWS / 2);

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 3.0;
export const DEFAULT_ZOOM = 0.6;
export const ZOOM_SPEED = 0.001;

export const TEXTURE_LOAD_RADIUS = 3;
export const SPRITE_POOL_SIZE = 4000;

export const CONTEST_DURATION_DAYS = 30;
export const TOP_WINNERS_COUNT = 2;

export const PLACEHOLDER_COLOR = 0x1e1e1e;
export const PLACEHOLDER_BORDER_COLOR = 0x2a2a2a;
export const HIGHLIGHT_COLOR = 0x6d28d9;

export enum Platform {
  YouTube = "youtube",
  YouTubeShort = "youtube_short",
  TikTok = "tiktok",
}

export enum BlockStatus {
  Empty = "empty",
  Claimed = "claimed",
  Ad = "ad",
}

export enum ContestStatus {
  Upcoming = "upcoming",
  Active = "active",
  Finalizing = "finalizing",
  Completed = "completed",
}

// --- Ad ring layout ---
// Ads form rectangular rings around the content spiral.
// Ring distances from center (in grid cells). Each ring places ads
// at corners and evenly along edges of a rectangle at that distance.
// Rings are tightly spaced so ads surround content at each level.

export const AD_RING_DISTANCES = [4, 8, 13, 19, 26, 34, 43, 53, 64, 76];
const AD_EDGE_SPACING = 3;

function buildAdSlots(): Set<string> {
  const slots = new Set<string>();
  for (const d of AD_RING_DISTANCES) {
    // Four corners
    slots.add(`${CENTER_X - d},${CENTER_Y - d}`);
    slots.add(`${CENTER_X + d},${CENTER_Y - d}`);
    slots.add(`${CENTER_X - d},${CENTER_Y + d}`);
    slots.add(`${CENTER_X + d},${CENTER_Y + d}`);

    // Edges: top and bottom rows
    for (let dx = -d + AD_EDGE_SPACING; dx <= d - AD_EDGE_SPACING; dx += AD_EDGE_SPACING) {
      slots.add(`${CENTER_X + dx},${CENTER_Y - d}`);
      slots.add(`${CENTER_X + dx},${CENTER_Y + d}`);
    }
    // Edges: left and right columns
    for (let dy = -d + AD_EDGE_SPACING; dy <= d - AD_EDGE_SPACING; dy += AD_EDGE_SPACING) {
      slots.add(`${CENTER_X - d},${CENTER_Y + dy}`);
      slots.add(`${CENTER_X + d},${CENTER_Y + dy}`);
    }
  }
  return slots;
}

const AD_SLOT_SET = buildAdSlots();

export function isAdSlot(col: number, row: number): boolean {
  return AD_SLOT_SET.has(`${col},${row}`);
}

export function getAdSlots(): Array<{ col: number; row: number }> {
  const result: Array<{ col: number; row: number }> = [];
  for (const key of AD_SLOT_SET) {
    const [c, r] = key.split(",").map(Number);
    result.push({ col: c, row: r });
  }
  return result;
}

/**
 * Returns the 0-based ad ring index for a given cell, or -1 if not an ad slot.
 * Ring 0 is the innermost (closest to center).
 */
export function getAdRingIndex(col: number, row: number): number {
  if (!AD_SLOT_SET.has(`${col},${row}`)) return -1;
  const cheb = Math.max(Math.abs(col - CENTER_X), Math.abs(row - CENTER_Y));
  for (let i = 0; i < AD_RING_DISTANCES.length; i++) {
    if (AD_RING_DISTANCES[i] === cheb) return i;
  }
  return -1;
}
