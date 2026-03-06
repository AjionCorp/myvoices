import { create } from "zustand";

export interface Comment {
  id: number;
  blockId: number;
  userIdentity: string;
  userName: string;
  text: string;
  createdAt: number;
  parentCommentId: number | null;
  repostOfId: number | null;
  likesCount: number;
  repliesCount: number;
  repostsCount: number;
  editedAt: number;
}

export interface CommentLike {
  id: number;
  commentId: number;
  userIdentity: string;
  createdAt: number;
}

interface CommentsState {
  comments: Map<number, Comment>;
  byBlock: Map<number, number[]>;
  commentLikes: Map<number, CommentLike>;
  likesByComment: Map<number, Set<string>>;

  setComments: (comments: Comment[]) => void;
  addComment: (comment: Comment) => void;
  updateComment: (comment: Comment) => void;
  removeComment: (id: number) => void;

  setCommentLikes: (likes: CommentLike[]) => void;
  addCommentLike: (like: CommentLike) => void;
  removeCommentLike: (id: number) => void;

  getCommentsForBlock: (blockId: number) => Comment[];
  getTopLevelComments: (blockId: number) => Comment[];
  getReplies: (parentCommentId: number) => Comment[];
  isLikedByUser: (commentId: number, userIdentity: string) => boolean;
  getComment: (id: number) => Comment | undefined;
}

export const useCommentsStore = create<CommentsState>((set, get) => ({
  comments: new Map(),
  byBlock: new Map(),
  commentLikes: new Map(),
  likesByComment: new Map(),

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
    const state = get();
    const comments = new Map(state.comments);
    comments.set(comment.id, comment);
    const byBlock = new Map(state.byBlock);
    const arr = [...(byBlock.get(comment.blockId) ?? [])];
    if (!arr.includes(comment.id)) arr.push(comment.id);
    byBlock.set(comment.blockId, arr);
    set({ comments, byBlock });
  },

  updateComment: (comment) => {
    const comments = new Map(get().comments);
    comments.set(comment.id, comment);
    set({ comments });
  },

  removeComment: (id) => {
    const state = get();
    const comment = state.comments.get(id);
    if (!comment) return;
    const comments = new Map(state.comments);
    comments.delete(id);
    const byBlock = new Map(state.byBlock);
    const arr = byBlock.get(comment.blockId);
    if (arr) {
      const filtered = arr.filter((cid) => cid !== id);
      if (filtered.length === 0) {
        byBlock.delete(comment.blockId);
      } else {
        byBlock.set(comment.blockId, filtered);
      }
    }
    set({ comments, byBlock });
  },

  setCommentLikes: (likes) => {
    const commentLikes = new Map<number, CommentLike>();
    const likesByComment = new Map<number, Set<string>>();
    for (const l of likes) {
      commentLikes.set(l.id, l);
      const s = likesByComment.get(l.commentId) ?? new Set<string>();
      s.add(l.userIdentity);
      likesByComment.set(l.commentId, s);
    }
    set({ commentLikes, likesByComment });
  },

  addCommentLike: (like) => {
    const state = get();
    const commentLikes = new Map(state.commentLikes);
    commentLikes.set(like.id, like);
    const likesByComment = new Map(state.likesByComment);
    const s = new Set(likesByComment.get(like.commentId));
    s.add(like.userIdentity);
    likesByComment.set(like.commentId, s);
    set({ commentLikes, likesByComment });
  },

  removeCommentLike: (id) => {
    const state = get();
    const like = state.commentLikes.get(id);
    if (!like) return;
    const commentLikes = new Map(state.commentLikes);
    commentLikes.delete(id);
    const likesByComment = new Map(state.likesByComment);
    const s = new Set(likesByComment.get(like.commentId));
    s.delete(like.userIdentity);
    if (s.size === 0) {
      likesByComment.delete(like.commentId);
    } else {
      likesByComment.set(like.commentId, s);
    }
    set({ commentLikes, likesByComment });
  },

  getCommentsForBlock: (blockId) => {
    const { comments, byBlock } = get();
    const ids = byBlock.get(blockId) ?? [];
    return ids
      .map((id) => comments.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  getTopLevelComments: (blockId) => {
    const { comments, byBlock } = get();
    const ids = byBlock.get(blockId) ?? [];
    return ids
      .map((id) => comments.get(id)!)
      .filter((c) => c && c.parentCommentId === null && c.repostOfId === null)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  getReplies: (parentCommentId) => {
    const { comments } = get();
    return [...comments.values()]
      .filter((c) => c.parentCommentId === parentCommentId)
      .sort((a, b) => a.createdAt - b.createdAt);
  },

  isLikedByUser: (commentId, userIdentity) => {
    const { likesByComment } = get();
    return likesByComment.get(commentId)?.has(userIdentity) ?? false;
  },

  getComment: (id) => get().comments.get(id),
}));
