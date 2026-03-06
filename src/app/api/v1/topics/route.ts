import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import { runSql, rowToObject, IS_MOCK } from "@/lib/spacetimedb/http-sql";
import { withApiKey } from "@/lib/api-middleware";

// ---------------------------------------------------------------------------
// Mock-data fast path — activated by USE_MOCK_DATA=true in .env.local
// ---------------------------------------------------------------------------
interface MockTopic {
  id: number;
  slug?: string;
  title?: string;
  description?: string;
  category?: string;
  creatorIdentity?: string;
  videoCount?: number;
  totalLikes?: number;
  totalDislikes?: number;
  totalViews?: number;
  isActive?: boolean;
  createdAt?: number;
  taxonomyNodeId?: number;
  taxonomyPath?: string;
  taxonomyName?: string;
  thumbnailVideoId?: string;
  thumbnailUrl?: string;
}

interface MockCache {
  topics: MappedTopic[];
  topVideos: Record<number, { videoId: string; platform: string; thumbnailUrl: string | null }>;
}

let _mockCache: MockCache | null = null;

function getMockData(): MockCache {
  if (_mockCache) return _mockCache;
  try {
    const filePath = resolve(process.cwd(), "src", "lib", "mock-topics.json");
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as { topics: MockTopic[] };
    const topVideos: Record<number, { videoId: string; platform: string; thumbnailUrl: string | null }> = {};
    const topics = raw.topics.map((t) => {
      if (t.thumbnailVideoId) {
        topVideos[t.id] = {
          videoId: t.thumbnailVideoId,
          platform: "youtube",
          thumbnailUrl: t.thumbnailUrl ?? null,
        };
      }
      return {
        id: t.id,
        slug: t.slug ?? "",
        title: t.title ?? "",
        description: t.description ?? "",
        category: t.category ?? "",
        taxonomyNodeId: t.taxonomyNodeId ?? null,
        taxonomyPath: t.taxonomyPath ?? "",
        taxonomyName: t.taxonomyName ?? "",
        creatorIdentity: t.creatorIdentity ?? "",
        videoCount: t.videoCount ?? 0,
        totalLikes: t.totalLikes ?? 0,
        totalDislikes: t.totalDislikes ?? 0,
        totalViews: t.totalViews ?? 0,
        isActive: t.isActive ?? true,
        createdAt: t.createdAt ?? 0,
        moderatorCount: 0,
      };
    });
    _mockCache = { topics, topVideos };
  } catch (err) {
    console.warn("[api/v1/topics] could not load mock-topics.json", err);
    _mockCache = { topics: [], topVideos: {} };
  }
  return _mockCache;
}

const TOPIC_COLUMNS = [
  "id", "slug", "title", "description", "category", "creator_identity",
  "video_count", "total_likes", "total_dislikes", "total_views", "is_active", "created_at", "taxonomy_node_id",
];
const TAXONOMY_COLUMNS = ["id", "name", "path"];
const MODERATOR_COLUMNS = ["id", "topic_id", "status"];

const TOP_BLOCK_COLUMNS = ["topic_id", "video_id", "platform", "thumbnail_url", "likes", "dislikes"];

interface MappedTopic {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  taxonomyNodeId: number | null;
  taxonomyPath: string;
  taxonomyName: string;
  creatorIdentity: string;
  videoCount: number;
  totalLikes: number;
  totalDislikes: number;
  totalViews: number;
  isActive: boolean;
  createdAt: number;
  moderatorCount: number;
}

function mapTopic(row: Record<string, unknown>): MappedTopic {
  return {
    id: Number(row.id),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    category: String(row.category ?? ""),
    taxonomyNodeId: row.taxonomy_node_id ? Number(row.taxonomy_node_id) : null,
    taxonomyPath: "",
    taxonomyName: "",
    creatorIdentity: String(row.creator_identity ?? ""),
    videoCount: Number(row.video_count ?? 0),
    totalLikes: Number(row.total_likes ?? 0),
    totalDislikes: Number(row.total_dislikes ?? 0),
    totalViews: Number(row.total_views ?? 0),
    isActive: Boolean(row.is_active),
    createdAt: Number(row.created_at ?? 0),
    moderatorCount: 0,
  };
}

export const GET = withApiKey(async () => {
  // Fast path: serve pre-generated mock data without hitting SpacetimeDB
  if (IS_MOCK) {
    return NextResponse.json(getMockData());
  }

  try {
    const topicResults = await runSql("SELECT * FROM topic");

    const topics: MappedTopic[] = [];
    const topicById = new Map<number, MappedTopic>();
    const res = topicResults[0];
    if (res) {
      for (const row of res.rows) {
        const obj = rowToObject(row, res.schema, TOPIC_COLUMNS);
        const topic = mapTopic(obj);
        topics.push(topic);
        topicById.set(topic.id, topic);
      }
    }

    // Join in taxonomy metadata for breadcrumb/filter UX.
    try {
      const taxonomyResults = await runSql("SELECT id, name, path FROM topic_taxonomy_node");
      const taxonomyById = new Map<number, { name: string; path: string }>();
      const taxonomyRes = taxonomyResults[0];
      if (taxonomyRes) {
        for (const row of taxonomyRes.rows) {
          const obj = rowToObject(row, taxonomyRes.schema, TAXONOMY_COLUMNS);
          taxonomyById.set(Number(obj.id), {
            name: String(obj.name ?? ""),
            path: String(obj.path ?? ""),
          });
        }
      }
      for (const topic of topics) {
        if (topic.taxonomyNodeId && taxonomyById.has(topic.taxonomyNodeId)) {
          const node = taxonomyById.get(topic.taxonomyNodeId)!;
          topic.taxonomyPath = node.path;
          topic.taxonomyName = node.name;
        }
      }
    } catch (err) {
      console.warn("[api/v1/topics] taxonomy query failed:", err);
    }

    // Include lightweight active moderator count per topic.
    try {
      const moderatorResults = await runSql("SELECT id, topic_id, status FROM topic_moderator");
      const moderatorRes = moderatorResults[0];
      if (moderatorRes) {
        for (const row of moderatorRes.rows) {
          const obj = rowToObject(row, moderatorRes.schema, MODERATOR_COLUMNS);
          const topicId = Number(obj.topic_id);
          const status = String(obj.status ?? "");
          if (status !== "active") continue;
          const topic = topicById.get(topicId);
          if (topic) topic.moderatorCount = (topic.moderatorCount ?? 0) + 1;
        }
      }
    } catch (err) {
      console.warn("[api/v1/topics] moderator query failed:", err);
    }

    // Compute best block per topic (highest likes - dislikes)
    const topVideos: Record<number, { videoId: string; platform: string; thumbnailUrl: string | null }> = {};
    const topScores: Record<number, number> = {};
    try {
      const blockResults = await runSql(
        "SELECT topic_id, video_id, platform, thumbnail_url, likes, dislikes FROM block WHERE status = 'claimed' AND video_id != '' AND platform != ''"
      );
      const blockRes = blockResults[0];
      if (blockRes) {
        for (const row of blockRes.rows) {
          const obj = rowToObject(row, blockRes.schema, TOP_BLOCK_COLUMNS);
          const topicId = Number(obj.topic_id);
          const videoId = String(obj.video_id ?? "");
          const platform = String(obj.platform ?? "");
          const thumbnailUrl = obj.thumbnail_url ? String(obj.thumbnail_url) : null;
          const score = Number(obj.likes ?? 0) - Number(obj.dislikes ?? 0);
          if (!videoId || !platform) continue;
          if (topScores[topicId] === undefined || score > topScores[topicId]) {
            topScores[topicId] = score;
            topVideos[topicId] = { videoId, platform, thumbnailUrl };
          }
        }
      }
    } catch (err) {
      // Degrade gracefully: keep topics visible even if top-video query fails.
      console.warn("[api/v1/topics] top video query failed:", err);
    }

    return NextResponse.json({ topics, topVideos });
  } catch (err) {
    console.error("[api/v1/topics] SpacetimeDB fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch topics" },
      { status: 500 }
    );
  }
});
