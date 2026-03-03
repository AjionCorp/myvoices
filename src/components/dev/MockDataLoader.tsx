"use client";

/**
 * Dev-only component. When NEXT_PUBLIC_USE_MOCK_DATA=true this seeds
 * the topic store from src/lib/mock-topics.json so the landing canvas
 * shows 10 000 mock topics without a live SpacetimeDB connection.
 *
 * Renders nothing — mount it anywhere in the tree.
 */

import { useEffect } from "react";
import { useTopicStore } from "@/stores/topic-store";
import type { Topic, TopicTaxonomyNode } from "@/stores/topic-store";

interface MockFile {
  topics: Topic[];
  taxonomyNodes: TopicTaxonomyNode[];
}

export function MockDataLoader() {
  const setTopics        = useTopicStore((s) => s.setTopics);
  const setTaxonomyNodes = useTopicStore((s) => s.setTaxonomyNodes);
  const topicsSize       = useTopicStore((s) => s.topics.size);

  useEffect(() => {
    // Only seed once — don't overwrite real SpacetimeDB data if it arrives
    if (topicsSize > 0) return;

    import("@/lib/mock-topics.json")
      .then((mod) => {
        const data = mod.default as unknown as MockFile;
        setTaxonomyNodes(data.taxonomyNodes);
        setTopics(data.topics);
        console.log(
          `[MockDataLoader] seeded ${data.topics.length} topics ` +
          `and ${data.taxonomyNodes.length} taxonomy nodes`
        );
      })
      .catch((err) => console.error("[MockDataLoader] failed to load mock data", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
