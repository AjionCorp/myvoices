import { create } from "zustand";
import { getConnection } from "@/lib/spacetimedb/client";

/** Resolve a SpacetimeDB identity hex to a human-readable display name. */
function resolveDisplayName(identity: string): string {
  try {
    const conn = getConnection();
    if (conn) {
      for (const profile of conn.db.user_profile.iter()) {
        if (profile.identity === identity) {
          return profile.displayName || profile.username || identity.slice(0, 8);
        }
      }
    }
  } catch {
    // Connection may not be ready yet
  }
  return identity.slice(0, 8);
}

export interface DirectMessage {
  id: number;
  conversationId: number;
  senderIdentity: string;
  recipientIdentity: string;
  text: string;
  isRead: boolean;
  isDeleted: boolean;
  createdAt: number;
}

export interface ConversationMeta {
  id: number;
  participantA: string;
  participantB: string;
  status: "active" | "request_pending" | "request_declined";
  requestRecipient: string;
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: number;
  otherIdentity: string;
  otherName: string;
  status: "active" | "request_pending" | "request_declined";
  requestRecipient: string;
  messages: DirectMessage[];
  lastMessage: DirectMessage;
  unreadCount: number;
}

interface MessagesState {
  messages: Map<number, DirectMessage>;
  conversations: Map<number, ConversationMeta>;
  myIdentity: string | null;
  totalUnread: number;
  requestCount: number;
  activeTab: "primary" | "requests";
  selectedConversationId: number | null;

  setMyIdentity: (identity: string) => void;
  addMessage: (message: DirectMessage) => void;
  updateMessage: (message: DirectMessage) => void;
  setMessages: (messages: DirectMessage[]) => void;

  addConversation: (conv: ConversationMeta) => void;
  updateConversation: (conv: ConversationMeta) => void;
  setConversations: (convs: ConversationMeta[]) => void;
  removeConversation: (id: number) => void;

  setActiveTab: (tab: "primary" | "requests") => void;
  setSelectedConversation: (id: number | null) => void;

  getPrimaryConversations: () => Conversation[];
  getRequestConversations: () => Conversation[];
  getConversations: () => Conversation[];
  getConversation: (otherIdentity: string) => DirectMessage[];
  getConversationById: (conversationId: number) => Conversation | null;
}

function computeUnreadCounts(
  messages: Map<number, DirectMessage>,
  conversations: Map<number, ConversationMeta>,
  myIdentity: string | null
): { totalUnread: number; requestCount: number } {
  if (!myIdentity) return { totalUnread: 0, requestCount: 0 };
  let totalUnread = 0;
  let requestCount = 0;

  for (const m of messages.values()) {
    if (m.recipientIdentity === myIdentity && !m.isRead && !m.isDeleted) {
      totalUnread++;
    }
  }

  for (const conv of conversations.values()) {
    if (conv.status === "request_pending" && conv.requestRecipient === myIdentity) {
      requestCount++;
    }
  }

  return { totalUnread, requestCount };
}

function buildConversationList(
  messages: Map<number, DirectMessage>,
  conversations: Map<number, ConversationMeta>,
  myIdentity: string | null,
  statusFilter: "active" | "request_pending"
): Conversation[] {
  if (!myIdentity) return [];

  const result: Conversation[] = [];

  for (const conv of conversations.values()) {
    if (statusFilter === "request_pending") {
      if (conv.status !== "request_pending" || conv.requestRecipient !== myIdentity) continue;
    } else {
      if (conv.status !== "active") continue;
    }

    const otherIdentity =
      conv.participantA === myIdentity ? conv.participantB : conv.participantA;

    // Collect messages for this conversation
    const convMessages: DirectMessage[] = [];
    for (const m of messages.values()) {
      if (m.conversationId === conv.id && !m.isDeleted) {
        convMessages.push(m);
      }
    }

    // Also match messages with conversationId=0 (legacy) by participant match
    for (const m of messages.values()) {
      if (m.conversationId === 0 && !m.isDeleted) {
        if (
          (m.senderIdentity === myIdentity && m.recipientIdentity === otherIdentity) ||
          (m.senderIdentity === otherIdentity && m.recipientIdentity === myIdentity)
        ) {
          // Avoid duplicates
          if (!convMessages.some((cm) => cm.id === m.id)) {
            convMessages.push(m);
          }
        }
      }
    }

    if (convMessages.length === 0) continue;

    const sorted = [...convMessages].sort((a, b) => b.createdAt - a.createdAt);
    const unreadCount = convMessages.filter(
      (m) => m.recipientIdentity === myIdentity && !m.isRead
    ).length;

    result.push({
      id: conv.id,
      otherIdentity,
      otherName: resolveDisplayName(otherIdentity),
      status: conv.status as Conversation["status"],
      requestRecipient: conv.requestRecipient,
      messages: sorted,
      lastMessage: sorted[0],
      unreadCount,
    });
  }

  // Also include legacy conversations (no ConversationMeta) for backward compat
  if (statusFilter === "active") {
    const convIds = new Set<string>();
    for (const conv of conversations.values()) {
      const other = conv.participantA === myIdentity ? conv.participantB : conv.participantA;
      convIds.add(other);
    }

    // Group orphan messages by other identity
    const orphanMap = new Map<string, DirectMessage[]>();
    for (const m of messages.values()) {
      if (m.conversationId !== 0 || m.isDeleted) continue;
      const other = m.senderIdentity === myIdentity ? m.recipientIdentity : m.senderIdentity;
      if (convIds.has(other)) continue; // already covered by a conversation
      if (!orphanMap.has(other)) orphanMap.set(other, []);
      orphanMap.get(other)!.push(m);
    }

    for (const [otherIdentity, msgs] of orphanMap.entries()) {
      const sorted = [...msgs].sort((a, b) => b.createdAt - a.createdAt);
      const unreadCount = msgs.filter(
        (m) => m.recipientIdentity === myIdentity && !m.isRead
      ).length;
      result.push({
        id: 0, // no server conversation
        otherIdentity,
        otherName: resolveDisplayName(otherIdentity),
        status: "active",
        requestRecipient: "",
        messages: sorted,
        lastMessage: sorted[0],
        unreadCount,
      });
    }
  }

  return result.sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: new Map(),
  conversations: new Map(),
  myIdentity: null,
  totalUnread: 0,
  requestCount: 0,
  activeTab: "primary",
  selectedConversationId: null,

  setMyIdentity: (identity) => {
    set({ myIdentity: identity });
    const { messages, conversations } = get();
    const counts = computeUnreadCounts(messages, conversations, identity);
    set(counts);
  },

  addMessage: (message) => {
    const { messages, conversations, myIdentity } = get();
    const updated = new Map(messages);
    updated.set(message.id, message);
    const counts = computeUnreadCounts(updated, conversations, myIdentity);
    set({ messages: updated, ...counts });
  },

  updateMessage: (message) => {
    const { messages, conversations, myIdentity } = get();
    const updated = new Map(messages);
    updated.set(message.id, message);
    const counts = computeUnreadCounts(updated, conversations, myIdentity);
    set({ messages: updated, ...counts });
  },

  setMessages: (msgs) => {
    const { myIdentity, conversations } = get();
    const updated = new Map<number, DirectMessage>();
    for (const m of msgs) updated.set(m.id, m);
    const counts = computeUnreadCounts(updated, conversations, myIdentity);
    set({ messages: updated, ...counts });
  },

  addConversation: (conv) => {
    const { conversations, messages, myIdentity } = get();
    const updated = new Map(conversations);
    updated.set(conv.id, conv);
    const counts = computeUnreadCounts(messages, updated, myIdentity);
    set({ conversations: updated, ...counts });
  },

  updateConversation: (conv) => {
    const { conversations, messages, myIdentity } = get();
    const updated = new Map(conversations);
    updated.set(conv.id, conv);
    const counts = computeUnreadCounts(messages, updated, myIdentity);
    set({ conversations: updated, ...counts });
  },

  setConversations: (convs) => {
    const { messages, myIdentity } = get();
    const map = new Map<number, ConversationMeta>();
    for (const c of convs) map.set(c.id, c);
    const counts = computeUnreadCounts(messages, map, myIdentity);
    set({ conversations: map, ...counts });
  },

  removeConversation: (id) => {
    const { conversations, messages, myIdentity } = get();
    const updated = new Map(conversations);
    updated.delete(id);
    const counts = computeUnreadCounts(messages, updated, myIdentity);
    set({ conversations: updated, ...counts });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedConversation: (id) => set({ selectedConversationId: id }),

  getPrimaryConversations: () => {
    const { messages, conversations, myIdentity } = get();
    return buildConversationList(messages, conversations, myIdentity, "active");
  },

  getRequestConversations: () => {
    const { messages, conversations, myIdentity } = get();
    return buildConversationList(messages, conversations, myIdentity, "request_pending");
  },

  // Legacy compat: returns all conversations (primary + requests)
  getConversations: () => {
    const { messages, conversations, myIdentity } = get();
    const primary = buildConversationList(messages, conversations, myIdentity, "active");
    const requests = buildConversationList(messages, conversations, myIdentity, "request_pending");
    return [...primary, ...requests].sort(
      (a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt
    );
  },

  getConversation: (otherIdentity) => {
    const { messages, myIdentity } = get();
    if (!myIdentity) return [];
    return [...messages.values()]
      .filter(
        (m) =>
          !m.isDeleted &&
          ((m.senderIdentity === myIdentity && m.recipientIdentity === otherIdentity) ||
            (m.senderIdentity === otherIdentity && m.recipientIdentity === myIdentity))
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  },

  getConversationById: (conversationId) => {
    const { conversations, messages, myIdentity } = get();
    if (!myIdentity) return null;
    const conv = conversations.get(conversationId);
    if (!conv) return null;

    const otherIdentity =
      conv.participantA === myIdentity ? conv.participantB : conv.participantA;

    const convMessages: DirectMessage[] = [];
    for (const m of messages.values()) {
      if (m.conversationId === conv.id && !m.isDeleted) {
        convMessages.push(m);
      }
    }

    const sorted = [...convMessages].sort((a, b) => b.createdAt - a.createdAt);
    if (sorted.length === 0) return null;

    const unreadCount = convMessages.filter(
      (m) => m.recipientIdentity === myIdentity && !m.isRead
    ).length;

    return {
      id: conv.id,
      otherIdentity,
      otherName: resolveDisplayName(otherIdentity),
      status: conv.status as Conversation["status"],
      requestRecipient: conv.requestRecipient,
      messages: sorted,
      lastMessage: sorted[0],
      unreadCount,
    };
  },
}));
