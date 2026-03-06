import { NextRequest, NextResponse } from "next/server";
import { runSql, rowToObject, IS_MOCK } from "@/lib/spacetimedb/http-sql";

const BLOCK_COLUMNS = [
  "id", "topic_id", "video_id", "platform", "thumbnail_url",
  "likes", "dislikes", "yt_views", "yt_likes", "owner_name",
  "owner_identity", "claimed_at",
];

const TOPIC_COLUMNS = ["id", "slug", "title", "category"];

/**
 * GET /api/v1/popular?limit=60
 * Returns the most-engaged blocks across all topics.
 */
export async function GET(request: NextRequest) {
  const limitParam = parseInt(request.nextUrl.searchParams.get("limit") || "60", 10);
  const limit = Math.max(1, Math.min(Number.isFinite(limitParam) ? limitParam : 60, 100));

  if (IS_MOCK) {
    return NextResponse.json({ blocks: [], topics: {} });
  }

  try {
    const [blockResults, topicResults] = await Promise.all([
      runSql(
        `SELECT id, topic_id, video_id, platform, thumbnail_url, likes, dislikes, yt_views, yt_likes, owner_name, owner_identity, claimed_at FROM block WHERE status = 'claimed' AND video_id != '' AND platform != ''`
      ),
      runSql(`SELECT id, slug, title, category FROM topic WHERE is_active = true`),
    ]);

    // Parse blocks
    const blocks: Array<Record<string, unknown>> = [];
    const blockRes = blockResults[0];
    if (blockRes) {
      for (const row of blockRes.rows) {
        const obj = rowToObject(row, blockRes.schema, BLOCK_COLUMNS);
        blocks.push({
          id: Number(obj.id),
          topicId: Number(obj.topic_id ?? obj.topicId),
          videoId: String(obj.video_id ?? obj.videoId ?? ""),
          platform: String(obj.platform ?? ""),
          thumbnailUrl: obj.thumbnail_url ?? obj.thumbnailUrl ?? null,
          likes: Number(obj.likes ?? 0),
          dislikes: Number(obj.dislikes ?? 0),
          ytViews: Number(obj.yt_views ?? obj.ytViews ?? 0),
          ytLikes: Number(obj.yt_likes ?? obj.ytLikes ?? 0),
          ownerName: obj.owner_name ?? obj.ownerName ?? null,
          claimedAt: Number(obj.claimed_at ?? obj.claimedAt ?? 0),
        });
      }
    }

    // Sort by engagement score desc, take limit
    blocks.sort((a, b) => {
      const scoreA = Math.max(a.ytViews as number, a.ytLikes as number) + ((a.likes as number) - (a.dislikes as number));
      const scoreB = Math.max(b.ytViews as number, b.ytLikes as number) + ((b.likes as number) - (b.dislikes as number));
      return scoreB - scoreA;
    });
    const limited = blocks.slice(0, limit);

    // Parse topics
    const topics: Record<number, { slug: string; title: string; category: string }> = {};
    const topicRes = topicResults[0];
    if (topicRes) {
      for (const row of topicRes.rows) {
        const obj = rowToObject(row, topicRes.schema, TOPIC_COLUMNS);
        const id = Number(obj.id);
        topics[id] = {
          slug: String(obj.slug ?? ""),
          title: String(obj.title ?? ""),
          category: String(obj.category ?? ""),
        };
      }
    }

    return NextResponse.json({ blocks: limited, topics });
  } catch (err) {
    console.error("[popular] SQL error:", err);
    return NextResponse.json({ error: "Failed to fetch popular" }, { status: 500 });
  }
}
