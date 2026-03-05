import { create } from "zustand";

export type NotificationType =
  | "comment_reply"
  | "comment_like"
  | "comment_repost"
  | "video_like"
  | "new_message"
  | "message_request"
  | "new_follow"
  | "topic_new_video"
  | "contest_result"
  | "moderator_application_reviewed";

export interface Notification {
  id: number;
  recipientIdentity: string;
  actorIdentity: string;
  actorName: string;
  notificationType: NotificationType;
  blockId: number;
  commentId: number;
  isRead: boolean;
  createdAt: number;
}

interface NotificationsState {
  notifications: Map<number, Notification>;
  unreadCount: number;

  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  updateNotification: (notification: Notification) => void;
  removeNotification: (id: number) => void;
  markRead: (id: number) => void;
  markAllRead: () => void;
  getAll: () => Notification[];
}

function computeUnread(map: Map<number, Notification>): number {
  let count = 0;
  for (const n of map.values()) {
    if (!n.isRead) count++;
  }
  return count;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: new Map(),
  unreadCount: 0,

  setNotifications: (notifications) => {
    const map = new Map<number, Notification>();
    for (const n of notifications) {
      map.set(n.id, n);
    }
    set({ notifications: map, unreadCount: computeUnread(map) });
  },

  addNotification: (notification) => {
    const { notifications } = get();
    notifications.set(notification.id, notification);
    const updated = new Map(notifications);
    set({ notifications: updated, unreadCount: computeUnread(updated) });
  },

  updateNotification: (notification) => {
    const { notifications } = get();
    notifications.set(notification.id, notification);
    const updated = new Map(notifications);
    set({ notifications: updated, unreadCount: computeUnread(updated) });
  },

  removeNotification: (id) => {
    const { notifications } = get();
    notifications.delete(id);
    const updated = new Map(notifications);
    set({ notifications: updated, unreadCount: computeUnread(updated) });
  },

  markRead: (id) => {
    const { notifications } = get();
    const notif = notifications.get(id);
    if (!notif || notif.isRead) return;
    notifications.set(id, { ...notif, isRead: true });
    const updated = new Map(notifications);
    set({ notifications: updated, unreadCount: computeUnread(updated) });
  },

  markAllRead: () => {
    const { notifications } = get();
    for (const [id, n] of notifications) {
      if (!n.isRead) notifications.set(id, { ...n, isRead: true });
    }
    set({ notifications: new Map(notifications), unreadCount: 0 });
  },

  getAll: () => {
    return [...get().notifications.values()].sort((a, b) => b.createdAt - a.createdAt);
  },
}));
