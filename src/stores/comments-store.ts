import { create } from "zustand";

export interface Comment {
  id: number;
  blockId: number;
  userIdentity: string;
  userName: string;
  text: string;
  createdAt: number;
}

interface CommentsState {
  comments: Map<number, Comment>;
  byBlock: Map<number, number[]>;

  setComments: (comments: Comment[]) => void;
  addComment: (comment: Comment) => void;
  removeComment: (id: number) => void;
  getCommentsForBlock: (blockId: number) => Comment[];
}

export const useCommentsStore = create<CommentsState>((set, get) => ({
  comments: new Map(),
  byBlock: new Map(),

  setComments: (comments) => {
    const map = new Map<number, Comment>();
    const byBlock = new Map<number, number[]>();
    for (const c of comments) {
      map.set(c.id, c);
      const arr = byBlock.get(c.blockId) ?? [];
      arr.push(c.id);
      byBlock.set(c.blockId, arr);
    }
    set({ comments: map, byBlock });
  },

  addComment: (comment) => {
    const { comments, byBlock } = get();
    comments.set(comment.id, comment);
    const arr = byBlock.get(comment.blockId) ?? [];
    arr.push(comment.id);
    byBlock.set(comment.blockId, arr);
    set({ comments: new Map(comments), byBlock: new Map(byBlock) });
  },

  removeComment: (id) => {
    const { comments, byBlock } = get();
    const comment = comments.get(id);
    if (!comment) return;
    comments.delete(id);
    const arr = byBlock.get(comment.blockId);
    if (arr) {
      const idx = arr.indexOf(id);
      if (idx >= 0) arr.splice(idx, 1);
      if (arr.length === 0) byBlock.delete(comment.blockId);
    }
    set({ comments: new Map(comments), byBlock: new Map(byBlock) });
  },

  getCommentsForBlock: (blockId) => {
    const { comments, byBlock } = get();
    const ids = byBlock.get(blockId) ?? [];
    return ids
      .map((id) => comments.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
}));
