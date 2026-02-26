import { create } from "zustand";
import { Platform, BlockStatus, GRID_COLS } from "@/lib/constants";
import { batchSpiralCoordinates } from "@/lib/canvas/spiral-layout";

export interface Block {
  id: number;
  x: number;
  y: number;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  platform: Platform | null;
  ownerIdentity: string | null;
  ownerName: string | null;
  likes: number;
  dislikes: number;
  status: BlockStatus;
  adImageUrl: string | null;
  adLinkUrl: string | null;
  claimedAt: number | null;
}

export function netScore(b: Block): number {
  return b.likes - b.dislikes;
}

// Spatial bucket index: divides the grid into coarse cells for fast viewport queries.
// Each bucket holds IDs of all blocks whose (x,y) falls inside it.
const BUCKET_SIZE = 32;
const BUCKET_COLS = Math.ceil(GRID_COLS / BUCKET_SIZE);

export class SpatialIndex {
  private buckets = new Map<number, number[]>();

  private key(bx: number, by: number) { return by * BUCKET_COLS + bx; }

  clear() { this.buckets.clear(); }

  insert(block: Block) {
    const bx = (block.x / BUCKET_SIZE) | 0;
    const by = (block.y / BUCKET_SIZE) | 0;
    const k = this.key(bx, by);
    let arr = this.buckets.get(k);
    if (!arr) { arr = []; this.buckets.set(k, arr); }
    arr.push(block.id);
  }

  remove(block: Block) {
    const bx = (block.x / BUCKET_SIZE) | 0;
    const by = (block.y / BUCKET_SIZE) | 0;
    const k = this.key(bx, by);
    const arr = this.buckets.get(k);
    if (!arr) return;
    const idx = arr.indexOf(block.id);
    if (idx >= 0) arr[idx] = arr[arr.length - 1], arr.pop();
    if (arr.length === 0) this.buckets.delete(k);
  }

  queryRange(c0: number, r0: number, c1: number, r1: number): number[] {
    const bx0 = Math.max(0, (c0 / BUCKET_SIZE) | 0);
    const by0 = Math.max(0, (r0 / BUCKET_SIZE) | 0);
    const bx1 = (c1 / BUCKET_SIZE) | 0;
    const by1 = (r1 / BUCKET_SIZE) | 0;
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
}

interface BlocksState {
  blocks: Map<number, Block>;
  spatial: SpatialIndex;
  urlIndex: Map<string, number>;
  topBlocks: Block[];
  totalClaimed: number;
  totalLikes: number;
  loading: boolean;

  setBlock: (block: Block) => void;
  setBlocks: (blocks: Block[]) => void;
  updateBlockPosition: (id: number, x: number, y: number) => void;
  updateBlockLikes: (id: number, likes: number) => void;
  updateBlockDislikes: (id: number, dislikes: number) => void;
  rebalanceBlocks: () => void;
  setTopBlocks: (blocks: Block[]) => void;
  getBlock: (id: number) => Block | undefined;
  getBlockByUrl: (url: string) => Block | undefined;
  setStats: (claimed: number, likes: number) => void;
  setLoading: (v: boolean) => void;
}

function rebuildUrlIndex(blocks: Map<number, Block>): Map<string, number> {
  const idx = new Map<string, number>();
  for (const [, b] of blocks) {
    if (b.videoUrl) idx.set(b.videoUrl, b.id);
  }
  return idx;
}

function rebuildSpatialIndex(blocks: Map<number, Block>): SpatialIndex {
  const si = new SpatialIndex();
  for (const b of blocks.values()) si.insert(b);
  return si;
}

export const useBlocksStore = create<BlocksState>((set, get) => ({
  blocks: new Map(),
  spatial: new SpatialIndex(),
  urlIndex: new Map(),
  topBlocks: [],
  totalClaimed: 0,
  totalLikes: 0,
  loading: true,

  setBlock: (block) => {
    const current = get().blocks;
    const old = current.get(block.id);
    if (old) get().spatial.remove(old);
    current.set(block.id, block);
    get().spatial.insert(block);
    const urlIndex = get().urlIndex;
    if (block.videoUrl) urlIndex.set(block.videoUrl, block.id);
    set({ blocks: current, urlIndex });
  },

  setBlocks: (blocks) => {
    const map = new Map<number, Block>();
    for (const b of blocks) map.set(b.id, b);
    set({ blocks: map, urlIndex: rebuildUrlIndex(map), spatial: rebuildSpatialIndex(map) });
  },

  updateBlockPosition: (id, x, y) => {
    const blocks = get().blocks;
    const block = blocks.get(id);
    if (!block) return;
    const spatial = get().spatial;
    spatial.remove(block);
    const newId = y * GRID_COLS + x;
    blocks.delete(id);
    const updated = { ...block, id: newId, x, y };
    blocks.set(newId, updated);
    spatial.insert(updated);
    set({ blocks });
  },

  updateBlockLikes: (id, likes) => {
    const blocks = get().blocks;
    const block = blocks.get(id);
    if (!block) return;
    blocks.set(id, { ...block, likes });
    set({ blocks });
  },

  updateBlockDislikes: (id, dislikes) => {
    const blocks = get().blocks;
    const block = blocks.get(id);
    if (!block) return;
    blocks.set(id, { ...block, dislikes });
    set({ blocks });
  },

  rebalanceBlocks: () => {
    const blocks = get().blocks;
    const claimed: Block[] = [];
    for (const b of blocks.values()) {
      if (b.status === BlockStatus.Claimed) claimed.push(b);
    }

    claimed.sort((a, b) => netScore(b) - netScore(a));

    const coords = batchSpiralCoordinates(claimed.length);
    const newBlocks = new Map(blocks);

    for (let i = 0; i < claimed.length; i++) {
      const b = claimed[i];
      const coord = coords[i];
      const newId = coord.y * GRID_COLS + coord.x;

      newBlocks.delete(b.id);

      const updated: Block = {
        ...b,
        id: newId,
        x: coord.x,
        y: coord.y,
      };
      newBlocks.set(newId, updated);
    }

    set({ blocks: newBlocks, urlIndex: rebuildUrlIndex(newBlocks), spatial: rebuildSpatialIndex(newBlocks) });
  },

  setTopBlocks: (blocks) => set({ topBlocks: blocks }),

  getBlock: (id) => get().blocks.get(id),

  getBlockByUrl: (url) => {
    const id = get().urlIndex.get(url);
    return id !== undefined ? get().blocks.get(id) : undefined;
  },

  setStats: (claimed, likes) =>
    set({ totalClaimed: claimed, totalLikes: likes }),

  setLoading: (v) => set({ loading: v }),
}));
