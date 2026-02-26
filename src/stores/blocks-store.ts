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

interface BlocksState {
  blocks: Map<number, Block>;
  urlIndex: Map<string, number>;
  topBlocks: Block[];
  totalClaimed: number;
  totalLikes: number;

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
}

function rebuildUrlIndex(blocks: Map<number, Block>): Map<string, number> {
  const idx = new Map<string, number>();
  for (const [id, b] of blocks) {
    if (b.videoUrl) idx.set(b.videoUrl, id);
  }
  return idx;
}

export const useBlocksStore = create<BlocksState>((set, get) => ({
  blocks: new Map(),
  urlIndex: new Map(),
  topBlocks: [],
  totalClaimed: 0,
  totalLikes: 0,

  setBlock: (block) => {
    const current = get().blocks;
    current.set(block.id, block);
    const urlIndex = get().urlIndex;
    if (block.videoUrl) urlIndex.set(block.videoUrl, block.id);
    set({ blocks: current, urlIndex });
  },

  setBlocks: (blocks) => {
    const map = new Map<number, Block>();
    for (const b of blocks) map.set(b.id, b);
    set({ blocks: map, urlIndex: rebuildUrlIndex(map) });
  },

  updateBlockPosition: (id, x, y) => {
    const blocks = get().blocks;
    const block = blocks.get(id);
    if (!block) return;
    const newId = y * GRID_COLS + x;
    blocks.delete(id);
    blocks.set(newId, { ...block, id: newId, x, y });
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

    set({ blocks: newBlocks, urlIndex: rebuildUrlIndex(newBlocks) });
  },

  setTopBlocks: (blocks) => set({ topBlocks: blocks }),

  getBlock: (id) => get().blocks.get(id),

  getBlockByUrl: (url) => {
    const id = get().urlIndex.get(url);
    return id !== undefined ? get().blocks.get(id) : undefined;
  },

  setStats: (claimed, likes) =>
    set({ totalClaimed: claimed, totalLikes: likes }),
}));
