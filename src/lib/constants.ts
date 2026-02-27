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

// --- Dynamic ad ring layout ---
// Ring count and positions are derived from the total claimed block count.
// The spiral fills roughly a circle of radius sqrt(count / pi) cells.
// We place ~1 ring per 3,000 blocks, evenly distributed from the center
// out to just past the content edge. Inner rings get denser ad spacing.

const BLOCKS_PER_RING = 3000;
const MIN_FIRST_RING = 4;

function buildDynamicAdRings(claimedCount: number): { distances: number[]; spacings: number[] } {
  const ringCount = Math.max(1, Math.round(claimedCount / BLOCKS_PER_RING));
  const contentRadius = Math.ceil(Math.sqrt(Math.max(claimedCount, 1) / Math.PI));
  const outerEdge = contentRadius + MIN_FIRST_RING;

  const distances: number[] = [];
  const spacings: number[] = [];
  for (let i = 0; i < ringCount; i++) {
    const t = ringCount === 1 ? 0.5 : i / (ringCount - 1);
    const d = Math.round(MIN_FIRST_RING + t * (outerEdge - MIN_FIRST_RING));
    if (distances.length > 0 && d <= distances[distances.length - 1]) continue;
    distances.push(d);
    spacings.push(Math.min(7, 3 + Math.floor(distances.length / 3) * 2));
  }
  return { distances, spacings };
}

function buildAdSlots(rings: { distances: number[]; spacings: number[] }): Set<string> {
  const slots = new Set<string>();
  for (let ri = 0; ri < rings.distances.length; ri++) {
    const d = rings.distances[ri];
    const sp = rings.spacings[ri];

    slots.add(`${CENTER_X - d},${CENTER_Y - d}`);
    slots.add(`${CENTER_X + d},${CENTER_Y - d}`);
    slots.add(`${CENTER_X - d},${CENTER_Y + d}`);
    slots.add(`${CENTER_X + d},${CENTER_Y + d}`);

    for (let dx = -d + sp; dx <= d - sp; dx += sp) {
      slots.add(`${CENTER_X + dx},${CENTER_Y - d}`);
      slots.add(`${CENTER_X + dx},${CENTER_Y + d}`);
    }
    for (let dy = -d + sp; dy <= d - sp; dy += sp) {
      slots.add(`${CENTER_X - d},${CENTER_Y + dy}`);
      slots.add(`${CENTER_X + d},${CENTER_Y + dy}`);
    }
  }
  return slots;
}

let adRings = buildDynamicAdRings(0);
let AD_SLOT_SET = buildAdSlots(adRings);

export function rebuildAdLayout(claimedCount: number): void {
  adRings = buildDynamicAdRings(claimedCount);
  AD_SLOT_SET = buildAdSlots(adRings);
}

export function getAdRingDistances(): number[] {
  return adRings.distances;
}

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

export function getAdRingIndex(col: number, row: number): number {
  if (!AD_SLOT_SET.has(`${col},${row}`)) return -1;
  const cheb = Math.max(Math.abs(col - CENTER_X), Math.abs(row - CENTER_Y));
  for (let i = 0; i < adRings.distances.length; i++) {
    if (adRings.distances[i] === cheb) return i;
  }
  return -1;
}
