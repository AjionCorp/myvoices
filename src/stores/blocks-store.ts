import { create } from "zustand";
import { Platform, BlockStatus } from "@/lib/constants";

export interface Block {
  id: number;
  topicId: number;
  x: number;
  y: number;
  videoId: string | null;
  platform: Platform | null;
  ownerIdentity: string | null;
  ownerName: string | null;
  likes: number;
  dislikes: number;
  ytViews: number;
  ytLikes: number;
  thumbnailUrl: string | null;
  status: BlockStatus;
  adImageUrl: string | null;
  adLinkUrl: string | null;
  claimedAt: number | null;
}

/** Combined score: YouTube metrics + platform engagement. */
export function netScore(b: Block): number {
  const yt = Math.max(b.ytViews, b.ytLikes);
  return yt + (b.likes - b.dislikes);
}

// Spatial bucket index: divides the grid into coarse cells for fast viewport queries.
// Handles arbitrary (including negative) coordinates.
const BUCKET_SIZE = 32;

export class SpatialIndex {
  // String key "bx,by" → array of block IDs
  private buckets = new Map<string, number[]>();

  private key(bx: number, by: number) {
    return `${bx},${by}`;
  }

  clear() { this.buckets.clear(); }

  insert(block: Block) {
    const bx = Math.floor(block.x / BUCKET_SIZE);
    const by = Math.floor(block.y / BUCKET_SIZE);
    const k = this.key(bx, by);
    let arr = this.buckets.get(k);
    if (!arr) { arr = []; this.buckets.set(k, arr); }
    arr.push(block.id);
  }

  remove(block: Block) {
    const bx = Math.floor(block.x / BUCKET_SIZE);
    const by = Math.floor(block.y / BUCKET_SIZE);
    const k = this.key(bx, by);
    const arr = this.buckets.get(k);
    if (!arr) return;
    const idx = arr.indexOf(block.id);
    if (idx >= 0) arr[idx] = arr[arr.length - 1], arr.pop();
    if (arr.length === 0) this.buckets.delete(k);
  }

  queryRange(c0: number, r0: number, c1: number, r1: number): number[] {
    const bx0 = Math.floor(c0 / BUCKET_SIZE);
    const by0 = Math.floor(r0 / BUCKET_SIZE);
    const bx1 = Math.floor(c1 / BUCKET_SIZE);
    const by1 = Math.floor(r1 / BUCKET_SIZE);
    const result: number[] = [];
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const arr = this.buckets.get(this.key(bx, by));
        if (arr) {
          for (let i = 0; i < arr.length; i++) result.push(arr[i]);
        }
      }
    }
    return result;
  }

  hasBucket(col: number, row: number): boolean {
    const bx = Math.floor(col / BUCKET_SIZE);
    const by = Math.floor(row / BUCKET_SIZE);
    const arr = this.buckets.get(this.key(bx, by));
    return !!arr && arr.length > 0;
  }
}

export interface ContentBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

interface BlocksState {
  blocks: Map<number, Block>;
  spatial: SpatialIndex;
  /** Maps "x,y" → block.id for O(1) cell lookup */
  positionIndex: Map<string, number>;
  videoIdIndex: Map<string, number>;
  rankIndex: Map<number, number>;
  contentBounds: ContentBounds;
  topBlocks: Block[];
  totalClaimed: number;
  totalLikes: number;
  loading: boolean;

  setBlock: (block: Block) => void;
  setBlocks: (blocks: Block[]) => void;
  removeBlock: (id: number) => void;
  updateBlockLikes: (id: number, likes: number) => void;
  updateBlockDislikes: (id: number, dislikes: number) => void;
  setTopBlocks: (blocks: Block[]) => void;
  getBlock: (id: number) => Block | undefined;
  getBlockAtPosition: (x: number, y: number) => Block | undefined;
  getBlockByVideoId: (videoId: string) => Block | undefined;
  getRank: (id: number) => number | undefined;
  setStats: (claimed: number, likes: number) => void;
  setLoading: (v: boolean) => void;
}

function posKey(x: number, y: number): string {
  return `${x},${y}`;
}

function rebuildVideoIdIndex(blocks: Map<number, Block>): Map<string, number> {
  const idx = new Map<string, number>();
  for (const [, b] of blocks) {
    if (b.videoId) idx.set(b.videoId, b.id);
  }
  return idx;
}

function rebuildSpatialIndex(blocks: Map<number, Block>): SpatialIndex {
  const si = new SpatialIndex();
  for (const b of blocks.values()) si.insert(b);
  return si;
}

function rebuildPositionIndex(blocks: Map<number, Block>): Map<string, number> {
  const pi = new Map<string, number>();
  for (const b of blocks.values()) pi.set(posKey(b.x, b.y), b.id);
  return pi;
}

function computeContentBounds(blocks: Map<number, Block>): ContentBounds {
  let minCol = Infinity, maxCol = -Infinity;
  let minRow = Infinity, maxRow = -Infinity;
  for (const b of blocks.values()) {
    if (b.x < minCol) minCol = b.x;
    if (b.x > maxCol) maxCol = b.x;
    if (b.y < minRow) minRow = b.y;
    if (b.y > maxRow) maxRow = b.y;
  }
  if (minCol === Infinity) return { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
  const pad = 2;
  return {
    minCol: minCol - pad,
    maxCol: maxCol + pad,
    minRow: minRow - pad,
    maxRow: maxRow + pad,
  };
}

function rebuildRankIndex(blocks: Map<number, Block>): Map<number, number> {
  const claimed: Block[] = [];
  for (const b of blocks.values()) {
    if (b.status === BlockStatus.Claimed) claimed.push(b);
  }
  claimed.sort((a, b) => netScore(b) - netScore(a));
  const ri = new Map<number, number>();
  for (let i = 0; i < claimed.length; i++) ri.set(claimed[i].id, i + 1);
  return ri;
}

export const useBlocksStore = create<BlocksState>((set, get) => ({
  blocks: new Map(),
  spatial: new SpatialIndex(),
  positionIndex: new Map(),
  videoIdIndex: new Map(),
  rankIndex: new Map(),
  contentBounds: { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 },
  topBlocks: [],
  totalClaimed: 0,
  totalLikes: 0,
  loading: true,

  setBlock: (block) => {
    const prev = get().blocks;
    const old = prev.get(block.id);

    // Update spatial + position indexes in-place (these are designed for mutation)
    if (old) {
      get().spatial.remove(old);
      get().positionIndex.delete(posKey(old.x, old.y));
    }
    get().spatial.insert(block);
    get().positionIndex.set(posKey(block.x, block.y), block.id);

    const blocks = new Map(prev);
    blocks.set(block.id, block);

    // Update videoIdIndex
    const videoIdIndex = new Map(get().videoIdIndex);
    if (old?.videoId && old.videoId !== block.videoId) videoIdIndex.delete(old.videoId);
    if (block.videoId) videoIdIndex.set(block.videoId, block.id);

    // Update totalClaimed if status changed
    const wasClaimedBefore = old?.status === BlockStatus.Claimed;
    const isClaimedNow = block.status === BlockStatus.Claimed;
    const claimedDelta = (isClaimedNow ? 1 : 0) - (wasClaimedBefore ? 1 : 0);
    const totalClaimed = get().totalClaimed + claimedDelta;

    // Rebuild rankIndex since score or status may have changed
    const rankIndex = rebuildRankIndex(blocks);

    // Expand content bounds incrementally
    const cb = get().contentBounds;
    const pad = 2;
    const newBounds: ContentBounds = {
      minCol: Math.min(cb.minCol, block.x - pad),
      maxCol: Math.max(cb.maxCol, block.x + pad),
      minRow: Math.min(cb.minRow, block.y - pad),
      maxRow: Math.max(cb.maxRow, block.y + pad),
    };

    set({ blocks, videoIdIndex, rankIndex, totalClaimed, contentBounds: newBounds });
  },

  setBlocks: (blocks) => {
    const map = new Map<number, Block>();
    let claimedCount = 0;
    for (const b of blocks) {
      map.set(b.id, b);
      if (b.status === BlockStatus.Claimed) claimedCount++;
    }
    set({
      blocks: map,
      videoIdIndex: rebuildVideoIdIndex(map),
      spatial: rebuildSpatialIndex(map),
      positionIndex: rebuildPositionIndex(map),
      rankIndex: rebuildRankIndex(map),
      contentBounds: computeContentBounds(map),
      totalClaimed: claimedCount,
    });
  },

  removeBlock: (id) => {
    const old = get().blocks.get(id);
    if (!old) return;

    // Mutate spatial + position indexes in-place
    get().spatial.remove(old);
    get().positionIndex.delete(posKey(old.x, old.y));

    const blocks = new Map(get().blocks);
    blocks.delete(id);

    // Clean up videoIdIndex
    const videoIdIndex = new Map(get().videoIdIndex);
    if (old.videoId) videoIdIndex.delete(old.videoId);

    // Update totalClaimed, rebuild rankIndex, and recompute content bounds
    const totalClaimed = get().totalClaimed - (old.status === BlockStatus.Claimed ? 1 : 0);
    const rankIndex = rebuildRankIndex(blocks);
    const contentBounds = computeContentBounds(blocks);

    set({ blocks, videoIdIndex, rankIndex, totalClaimed, contentBounds });
  },

  updateBlockLikes: (id, likes) => {
    const prev = get().blocks;
    const block = prev.get(id);
    if (!block) return;
    const blocks = new Map(prev);
    blocks.set(id, { ...block, likes });
    set({ blocks, rankIndex: rebuildRankIndex(blocks) });
  },

  updateBlockDislikes: (id, dislikes) => {
    const prev = get().blocks;
    const block = prev.get(id);
    if (!block) return;
    const blocks = new Map(prev);
    blocks.set(id, { ...block, dislikes });
    set({ blocks, rankIndex: rebuildRankIndex(blocks) });
  },

  setTopBlocks: (blocks) => set({ topBlocks: blocks }),

  getBlock: (id) => get().blocks.get(id),

  getBlockAtPosition: (x, y) => {
    const id = get().positionIndex.get(posKey(x, y));
    return id !== undefined ? get().blocks.get(id) : undefined;
  },

  getBlockByVideoId: (videoId) => {
    const id = get().videoIdIndex.get(videoId);
    return id !== undefined ? get().blocks.get(id) : undefined;
  },

  getRank: (id) => get().rankIndex.get(id),

  setStats: (claimed, likes) =>
    set({ totalClaimed: claimed, totalLikes: likes }),

  setLoading: (v) => set({ loading: v }),
}));
