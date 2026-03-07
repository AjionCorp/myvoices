import { NextRequest, NextResponse } from "next/server";
import { runSql, rowToObject, IS_MOCK } from "@/lib/spacetimedb/http-sql";

const BLOCK_COLUMNS = [
  "id", "topic_id", "video_id", "platform", "thumbnail_url",
  "likes", "dislikes", "yt_views", "yt_likes", "owner_name",
  "owner_identity", "claimed_at",
];

const TOPIC_COLUMNS = ["id", "slug", "title", "category"];

/**
 * GET /api/v1/liked?blockIds=1,2,3
 * Returns block details for the given IDs + topic metadata.
 */
export async function GET(request: NextRequest) {
  const blockIdsParam = request.nextUrl.searchParams.get("blockIds");
  if (!blockIdsParam) {
    return NextResponse.json({ blocks: [], topics: {} });
  }

  const blockIds = blockIdsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const uniqueBlockIds = [...new Set(blockIds)].slice(0, 200);

  if (uniqueBlockIds.length === 0 || IS_MOCK) {
    return NextResponse.json({ blocks: [], topics: {} });
  }

  try {
    // SpacetimeDB does not support IN (...) — build OR chains instead.
    const blockIdClause = uniqueBlockIds.map((id) => `id = ${id}`).join(" OR ");
    const blockResults = await runSql(
      `SELECT id, topic_id, video_id, platform, thumbnail_url, likes, dislikes, yt_views, yt_likes, owner_name, owner_identity, claimed_at FROM block WHERE (${blockIdClause}) AND status = 'claimed' AND video_id != '' AND platform != ''`
    );

    const blocks: Array<Record<string, unknown>> = [];
    const topicIdSet = new Set<number>();
    const blockRes = blockResults[0];
    if (blockRes) {
      for (const row of blockRes.rows) {
        const obj = rowToObject(row, blockRes.schema, BLOCK_COLUMNS);
        const topicId = Number(obj.topic_id ?? obj.topicId);
        topicIdSet.add(topicId);
        blocks.push({
          id: Number(obj.id),
          topicId,
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

    // Fetch topics
    const topics: Record<number, { slug: string; title: string; category: string }> = {};
    if (topicIdSet.size > 0) {
      const topicIdClause = [...topicIdSet].map((id) => `id = ${id}`).join(" OR ");
      const topicResults = await runSql(
        `SELECT id, slug, title, category FROM topic WHERE ${topicIdClause}`
      );
      const topicRes = topicResults[0];
      if (topicRes) {
        for (const row of topicRes.rows) {
          const obj = rowToObject(row, topicRes.schema, TOPIC_COLUMNS);
          topics[Number(obj.id)] = {
            slug: String(obj.slug ?? ""),
            title: String(obj.title ?? ""),
            category: String(obj.category ?? ""),
          };
        }
      }
    }

    return NextResponse.json({ blocks, topics });
  } catch (err) {
    console.error("[liked] SQL error:", err);
    return NextResponse.json({ error: "Failed to fetch liked" }, { status: 500 });
  }
}
