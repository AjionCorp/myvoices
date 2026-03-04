import { create } from "zustand";

export interface DirectMessage {
  id: number;
  senderIdentity: string;
  recipientIdentity: string;
  text: string;
  isRead: boolean;
  createdAt: number;
}

export interface Conversation {
  otherIdentity: string;
  otherName: string;
  messages: DirectMessage[];
  lastMessage: DirectMessage;
  unreadCount: number;
}

interface MessagesState {
  messages: Map<number, DirectMessage>;
  myIdentity: string | null;
  totalUnread: number;

  setMyIdentity: (identity: string) => void;
  addMessage: (message: DirectMessage) => void;
  updateMessage: (message: DirectMessage) => void;
  setMessages: (messages: DirectMessage[]) => void;

  getConversations: () => Conversation[];
  getConversation: (otherIdentity: string) => DirectMessage[];
}

function computeTotalUnread(messages: Map<number, DirectMessage>, myIdentity: string | null): number {
  if (!myIdentity) return 0;
  let count = 0;
  for (const m of messages.values()) {
    if (m.recipientIdentity === myIdentity && !m.isRead) count++;
  }
  return count;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: new Map(),
  myIdentity: null,
  totalUnread: 0,

  setMyIdentity: (identity) => {
    set({ myIdentity: identity });
    const { messages } = get();
    set({ totalUnread: computeTotalUnread(messages, identity) });
  },

  addMessage: (message) => {
    const { messages, myIdentity } = get();
    const updated = new Map(messages);
    updated.set(message.id, message);
    set({ messages: updated, totalUnread: computeTotalUnread(updated, myIdentity) });
  },

  updateMessage: (message) => {
    const { messages, myIdentity } = get();
    const updated = new Map(messages);
    updated.set(message.id, message);
    set({ messages: updated, totalUnread: computeTotalUnread(updated, myIdentity) });
  },

  setMessages: (msgs) => {
    const { myIdentity } = get();
    const updated = new Map<number, DirectMessage>();
    for (const m of msgs) updated.set(m.id, m);
    set({ messages: updated, totalUnread: computeTotalUnread(updated, myIdentity) });
  },

  getConversations: () => {
    const { messages, myIdentity } = get();
    if (!myIdentity) return [];

    const convMap = new Map<string, DirectMessage[]>();

    for (const msg of messages.values()) {
      const otherIdentity =
        msg.senderIdentity === myIdentity ? msg.recipientIdentity : msg.senderIdentity;
      if (!convMap.has(otherIdentity)) convMap.set(otherIdentity, []);
      convMap.get(otherIdentity)!.push(msg);
    }

    const conversations: Conversation[] = [];
    for (const [otherIdentity, msgs] of convMap.entries()) {
      const sorted = [...msgs].sort((a, b) => b.createdAt - a.createdAt);
      const lastMessage = sorted[0];
      const unreadCount = msgs.filter(
        (m) => m.recipientIdentity === myIdentity && !m.isRead
      ).length;

      conversations.push({
        otherIdentity,
        otherName: otherIdentity.slice(0, 8),
        messages: sorted,
        lastMessage,
        unreadCount,
      });
    }

    return conversations.sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);
  },

  getConversation: (otherIdentity) => {
    const { messages, myIdentity } = get();
    if (!myIdentity) return [];
    return [...messages.values()]
      .filter(
        (m) =>
          (m.senderIdentity === myIdentity && m.recipientIdentity === otherIdentity) ||
          (m.senderIdentity === otherIdentity && m.recipientIdentity === myIdentity)
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  },
}));
