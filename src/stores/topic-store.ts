import { create } from "zustand";

export interface Topic {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  taxonomyNodeId: number | null;
  taxonomyPath?: string;
  taxonomyName?: string;
  creatorIdentity: string;
  videoCount: number;
  totalLikes: number;
  totalDislikes: number;
  totalViews: number;
  isActive: boolean;
  createdAt: number;
  moderatorCount?: number;
  // Present in mock data (mock-topics.json) — not stored in SpacetimeDB
  thumbnailVideoId?: string;
  thumbnailUrl?: string;
}

export interface TopicTaxonomyNode {
  id: number;
  slug: string;
  name: string;
  parentId: number | null;
  path: string;
  depth: number;
  isActive: boolean;
  createdAt: number;
}

export interface TopicModerator {
  id: number;
  topicId: number;
  identity: string;
  role: string;
  status: string;
  grantedBy: string | null;
  createdAt: number;
}

export interface TopicModeratorApplication {
  id: number;
  topicId: number;
  applicantIdentity: string;
  message: string;
  status: string;
  reviewedBy: string | null;
  createdAt: number;
  reviewedAt: number | null;
}

interface TopicState {
  topics: Map<number, Topic>;
  taxonomyNodes: Map<number, TopicTaxonomyNode>;
  moderators: Map<number, TopicModerator>;
  moderatorApplications: Map<number, TopicModeratorApplication>;
  activeTopic: Topic | null;

  setTopic: (topic: Topic) => void;
  setTopics: (topics: Topic[]) => void;
  setTaxonomyNodes: (nodes: TopicTaxonomyNode[]) => void;
  setModerators: (mods: TopicModerator[]) => void;
  setModeratorApplications: (applications: TopicModeratorApplication[]) => void;
  deleteTopic: (id: number) => void;
  setActiveTopic: (topic: Topic | null) => void;
  getTopicBySlug: (slug: string) => Topic | undefined;
  isModeratorForTopic: (topicId: number, identity: string | null | undefined) => boolean;
  getPendingApplicationsForTopic: (topicId: number) => TopicModeratorApplication[];
}

export const useTopicStore = create<TopicState>((set, get) => ({
  topics: new Map(),
  taxonomyNodes: new Map(),
  moderators: new Map(),
  moderatorApplications: new Map(),
  activeTopic: null,

  setTopic: (topic) => {
    const { activeTopic } = get();
    const topics = new Map(get().topics);
    topics.set(topic.id, topic);
    set({
      topics,
      activeTopic: activeTopic?.id === topic.id ? topic : activeTopic,
    });
  },

  setTopics: (topics) => {
    const map = new Map<number, Topic>();
    for (const t of topics) map.set(t.id, t);
    const activeTopic = get().activeTopic;
    set({
      topics: map,
      activeTopic: activeTopic ? (map.get(activeTopic.id) ?? null) : null,
    });
  },

  setTaxonomyNodes: (nodes) => {
    const map = new Map<number, TopicTaxonomyNode>();
    for (const n of nodes) map.set(n.id, n);
    set({ taxonomyNodes: map });
  },

  setModerators: (mods) => {
    const map = new Map<number, TopicModerator>();
    for (const m of mods) map.set(m.id, m);
    set({ moderators: map });
  },

  setModeratorApplications: (applications) => {
    const map = new Map<number, TopicModeratorApplication>();
    for (const a of applications) map.set(a.id, a);
    set({ moderatorApplications: map });
  },

  deleteTopic: (id) => {
    const topics = new Map(get().topics);
    topics.delete(id);
    const activeTopic = get().activeTopic;
    set({
      topics,
      activeTopic: activeTopic?.id === id ? null : activeTopic,
    });
  },

  setActiveTopic: (topic) => set({ activeTopic: topic }),

  getTopicBySlug: (slug) => {
    for (const t of get().topics.values()) {
      if (t.slug === slug) return t;
    }
    return undefined;
  },

  isModeratorForTopic: (topicId, identity) => {
    if (!identity) return false;
    for (const m of get().moderators.values()) {
      if (m.topicId === topicId && m.identity === identity && m.status === "active") {
        return true;
      }
    }
    return false;
  },

  getPendingApplicationsForTopic: (topicId) => {
    return [...get().moderatorApplications.values()].filter(
      (a) => a.topicId === topicId && a.status === "pending"
    );
  },
}));
