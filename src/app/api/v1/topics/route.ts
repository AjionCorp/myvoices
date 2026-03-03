import { NextResponse } from "next/server";
import { runSql, rowToObject } from "@/lib/spacetimedb/http-sql";

const TOPIC_COLUMNS = [
  "id", "slug", "title", "description", "category", "creator_identity",
  "video_count", "total_likes", "total_dislikes", "total_views", "is_active", "created_at", "taxonomy_node_id",
];
const TAXONOMY_COLUMNS = ["id", "name", "path"];
const MODERATOR_COLUMNS = ["id", "topic_id", "status"];

const TOP_BLOCK_COLUMNS = ["topic_id", "video_id", "platform", "thumbnail_url", "likes", "dislikes"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTopic(row: Record<string, unknown>): any {
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

export async function GET() {
  try {
    const topicResults = await runSql("SELECT * FROM topic");

    const topics: ReturnType<typeof mapTopic>[] = [];
    const topicById = new Map<number, ReturnType<typeof mapTopic>>();
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
}
