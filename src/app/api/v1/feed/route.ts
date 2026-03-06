import { NextRequest, NextResponse } from "next/server";
import { runSql, rowToObject, IS_MOCK } from "@/lib/spacetimedb/http-sql";

const BLOCK_COLUMNS = [
  "id", "topic_id", "video_id", "platform", "thumbnail_url",
  "likes", "dislikes", "yt_views", "yt_likes", "owner_name",
  "owner_identity", "claimed_at",
];

const TOPIC_COLUMNS = [
  "id", "slug", "title", "category",
];

/**
 * GET /api/v1/feed?topicIds=1,2,3&limit=50
 * Returns recent claimed blocks from the given topic IDs, joined with topic metadata.
 */
export async function GET(request: NextRequest) {
  const topicIdsParam = request.nextUrl.searchParams.get("topicIds");
  const limitParam = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);
  const limit = Math.max(1, Math.min(Number.isFinite(limitParam) ? limitParam : 50, 100));

  if (!topicIdsParam) {
    return NextResponse.json({ blocks: [], topics: {} });
  }

  const topicIds = topicIdsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (topicIds.length === 0) {
    return NextResponse.json({ blocks: [], topics: {} });
  }

  if (IS_MOCK) {
    return NextResponse.json({ blocks: [], topics: {} });
  }

  try {
    const idList = topicIds.join(",");

    const [blockResults, topicResults] = await Promise.all([
      runSql(
        `SELECT id, topic_id, video_id, platform, thumbnail_url, likes, dislikes, yt_views, yt_likes, owner_name, owner_identity, claimed_at FROM block WHERE topic_id IN (${idList}) AND status = 'claimed' AND video_id != '' AND platform != ''`
      ),
      runSql(
        `SELECT id, slug, title, category FROM topic WHERE id IN (${idList})`
      ),
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

    // Sort by claimedAt descending (newest first), take limit
    blocks.sort((a, b) => (b.claimedAt as number) - (a.claimedAt as number));
    const limited = blocks.slice(0, limit);

    // Parse topics into a lookup map
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
    console.error("[feed] SQL error:", err);
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}
