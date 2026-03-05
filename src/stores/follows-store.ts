import { create } from "zustand";

export interface UserFollow {
  id: number;
  followerIdentity: string;
  followingIdentity: string;
  createdAt: number;
}

interface FollowsState {
  follows: Map<number, UserFollow>;

  setFollows: (follows: UserFollow[]) => void;
  addFollow: (follow: UserFollow) => void;
  removeFollow: (id: number) => void;
  updateFollow: (follow: UserFollow) => void;

  isFollowing: (myIdentity: string, targetIdentity: string) => boolean;
  isFollowedBy: (myIdentity: string, targetIdentity: string) => boolean;
  areMutualFollowers: (a: string, b: string) => boolean;
  getFollowerCount: (identity: string) => number;
  getFollowingCount: (identity: string) => number;
  getFollowers: (identity: string) => UserFollow[];
  getFollowing: (identity: string) => UserFollow[];
}

export const useFollowsStore = create<FollowsState>((set, get) => ({
  follows: new Map(),

  setFollows: (follows) => {
    const map = new Map<number, UserFollow>();
    for (const f of follows) map.set(f.id, f);
    set({ follows: map });
  },

  addFollow: (follow) => {
    const updated = new Map(get().follows);
    updated.set(follow.id, follow);
    set({ follows: updated });
  },

  removeFollow: (id) => {
    const updated = new Map(get().follows);
    updated.delete(id);
    set({ follows: updated });
  },

  updateFollow: (follow) => {
    const updated = new Map(get().follows);
    updated.set(follow.id, follow);
    set({ follows: updated });
  },

  isFollowing: (myIdentity, targetIdentity) => {
    for (const f of get().follows.values()) {
      if (f.followerIdentity === myIdentity && f.followingIdentity === targetIdentity) return true;
    }
    return false;
  },

  isFollowedBy: (myIdentity, targetIdentity) => {
    for (const f of get().follows.values()) {
      if (f.followerIdentity === targetIdentity && f.followingIdentity === myIdentity) return true;
    }
    return false;
  },

  areMutualFollowers: (a, b) => {
    const { isFollowing } = get();
    return isFollowing(a, b) && isFollowing(b, a);
  },

  getFollowerCount: (identity) => {
    let count = 0;
    for (const f of get().follows.values()) {
      if (f.followingIdentity === identity) count++;
    }
    return count;
  },

  getFollowingCount: (identity) => {
    let count = 0;
    for (const f of get().follows.values()) {
      if (f.followerIdentity === identity) count++;
    }
    return count;
  },

  getFollowers: (identity) => {
    return [...get().follows.values()].filter((f) => f.followingIdentity === identity);
  },

  getFollowing: (identity) => {
    return [...get().follows.values()].filter((f) => f.followerIdentity === identity);
  },
}));
