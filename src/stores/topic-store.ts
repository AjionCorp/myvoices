import { create } from "zustand";

export interface Topic {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  creatorIdentity: string;
  videoCount: number;
  totalLikes: number;
  totalDislikes: number;
  totalViews: number;
  isActive: boolean;
  createdAt: number;
}

interface TopicState {
  topics: Map<number, Topic>;
  activeTopic: Topic | null;

  setTopic: (topic: Topic) => void;
  setTopics: (topics: Topic[]) => void;
  deleteTopic: (id: number) => void;
  setActiveTopic: (topic: Topic | null) => void;
  getTopicBySlug: (slug: string) => Topic | undefined;
}

export const useTopicStore = create<TopicState>((set, get) => ({
  topics: new Map(),
  activeTopic: null,

  setTopic: (topic) => {
    const topics = new Map(get().topics);
    topics.set(topic.id, topic);
    set({ topics });
  },

  setTopics: (topics) => {
    const map = new Map<number, Topic>();
    for (const t of topics) map.set(t.id, t);
    set({ topics: map });
  },

  deleteTopic: (id) => {
    const topics = new Map(get().topics);
    topics.delete(id);
    set({ topics });
  },

  setActiveTopic: (topic) => set({ activeTopic: topic }),

  getTopicBySlug: (slug) => {
    for (const t of get().topics.values()) {
      if (t.slug === slug) return t;
    }
    return undefined;
  },
}));
