import { create } from "zustand";

export interface UserBlock {
  id: number;
  blockerIdentity: string;
  blockedIdentity: string;
  createdAt: number;
}

export interface UserMute {
  id: number;
  muterIdentity: string;
  mutedIdentity: string;
  createdAt: number;
}

interface ModerationState {
  blocks: Map<number, UserBlock>;
  mutes: Map<number, UserMute>;

  setBlocks: (blocks: UserBlock[]) => void;
  addBlock: (block: UserBlock) => void;
  removeBlock: (id: number) => void;

  setMutes: (mutes: UserMute[]) => void;
  addMute: (mute: UserMute) => void;
  removeMute: (id: number) => void;

  /** True if I blocked them (one direction). */
  isBlockedByMe: (myIdentity: string, targetIdentity: string) => boolean;
  /** True if either user blocked the other (symmetric). */
  isBlocked: (myIdentity: string, targetIdentity: string) => boolean;
  /** True if I muted them. */
  isMuted: (myIdentity: string, targetIdentity: string) => boolean;

  /** Set of identities I should hide (blocked both ways + muted). */
  getHiddenIdentities: (myIdentity: string) => Set<string>;
}

export const useModerationStore = create<ModerationState>((set, get) => ({
  blocks: new Map(),
  mutes: new Map(),

  setBlocks: (blocks) => {
    const map = new Map<number, UserBlock>();
    for (const b of blocks) map.set(b.id, b);
    set({ blocks: map });
  },

  addBlock: (block) => {
    const updated = new Map(get().blocks);
    updated.set(block.id, block);
    set({ blocks: updated });
  },

  removeBlock: (id) => {
    const updated = new Map(get().blocks);
    updated.delete(id);
    set({ blocks: updated });
  },

  setMutes: (mutes) => {
    const map = new Map<number, UserMute>();
    for (const m of mutes) map.set(m.id, m);
    set({ mutes: map });
  },

  addMute: (mute) => {
    const updated = new Map(get().mutes);
    updated.set(mute.id, mute);
    set({ mutes: updated });
  },

  removeMute: (id) => {
    const updated = new Map(get().mutes);
    updated.delete(id);
    set({ mutes: updated });
  },

  isBlockedByMe: (myIdentity, targetIdentity) => {
    for (const b of get().blocks.values()) {
      if (b.blockerIdentity === myIdentity && b.blockedIdentity === targetIdentity) return true;
    }
    return false;
  },

  isBlocked: (myIdentity, targetIdentity) => {
    for (const b of get().blocks.values()) {
      if (
        (b.blockerIdentity === myIdentity && b.blockedIdentity === targetIdentity) ||
        (b.blockerIdentity === targetIdentity && b.blockedIdentity === myIdentity)
      ) {
        return true;
      }
    }
    return false;
  },

  isMuted: (myIdentity, targetIdentity) => {
    for (const m of get().mutes.values()) {
      if (m.muterIdentity === myIdentity && m.mutedIdentity === targetIdentity) return true;
    }
    return false;
  },

  getHiddenIdentities: (myIdentity) => {
    const hidden = new Set<string>();
    for (const b of get().blocks.values()) {
      if (b.blockerIdentity === myIdentity) hidden.add(b.blockedIdentity);
      if (b.blockedIdentity === myIdentity) hidden.add(b.blockerIdentity);
    }
    for (const m of get().mutes.values()) {
      if (m.muterIdentity === myIdentity) hidden.add(m.mutedIdentity);
    }
    return hidden;
  },
}));
