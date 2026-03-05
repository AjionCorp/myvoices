import { NextRequest, NextResponse } from "next/server";
import { runSql, rowToObject } from "@/lib/spacetimedb/http-sql";
import { withApiKey } from "@/lib/api-middleware";

const TOPIC_COLUMNS = [
  "id", "slug", "title", "description", "category", "creator_identity",
  "video_count", "total_likes", "total_dislikes", "total_views", "is_active",
  "created_at", "taxonomy_node_id",
];

const BLOCK_COLUMNS = [
  "id", "topic_id", "video_id", "platform", "thumbnail_url",
  "likes", "dislikes", "yt_views", "yt_likes", "owner_name", "owner_identity",
];

const SLUG_RE = /^[a-z0-9-]{1,80}$/;

export const GET = withApiKey(async (_request: NextRequest, context) => {
  const slug = context.params?.slug;
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Invalid topic slug" }, { status: 400 });
  }

  try {
    const topicResults = await runSql(
      `SELECT * FROM topic WHERE slug = '${slug.replace(/'/g, "''")}'`
    );
    const topicRes = topicResults[0];
    if (!topicRes || topicRes.rows.length === 0) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const row = rowToObject(topicRes.rows[0], topicRes.schema, TOPIC_COLUMNS);
    const topicId = Number(row.id);

    // Fetch top 20 blocks by score
    const blockResults = await runSql(
      `SELECT id, topic_id, video_id, platform, thumbnail_url, likes, dislikes, yt_views, yt_likes, owner_name, owner_identity FROM block WHERE topic_id = ${topicId} AND status = 'claimed' AND video_id != '' AND platform != ''`
    );

    const blocks: Array<Record<string, unknown>> = [];
    const blockRes = blockResults[0];
    if (blockRes) {
      for (const bRow of blockRes.rows) {
        const obj = rowToObject(bRow, blockRes.schema, BLOCK_COLUMNS);
        const likes = Number(obj.likes ?? 0);
        const dislikes = Number(obj.dislikes ?? 0);
        const ytViews = Number(obj.yt_views ?? obj.ytViews ?? 0);
        const ytLikes = Number(obj.yt_likes ?? obj.ytLikes ?? 0);
        blocks.push({
          id: Number(obj.id),
          videoId: String(obj.video_id ?? obj.videoId ?? ""),
          platform: String(obj.platform ?? ""),
          thumbnailUrl: obj.thumbnail_url ?? obj.thumbnailUrl ?? null,
          likes,
          dislikes,
          ytViews,
          ytLikes,
          ownerName: obj.owner_name ?? obj.ownerName ?? null,
          score: Math.max(ytViews, ytLikes) + (likes - dislikes),
        });
      }
    }

    // Sort by score desc, limit top 20
    blocks.sort((a, b) => (b.score as number) - (a.score as number));
    const topBlocks = blocks.slice(0, 20);

    return NextResponse.json({
      topic: {
        id: topicId,
        slug: String(row.slug ?? ""),
        title: String(row.title ?? ""),
        description: String(row.description ?? ""),
        category: String(row.category ?? ""),
        creatorIdentity: String(row.creator_identity ?? row.creatorIdentity ?? ""),
        videoCount: Number(row.video_count ?? row.videoCount ?? 0),
        totalLikes: Number(row.total_likes ?? row.totalLikes ?? 0),
        totalDislikes: Number(row.total_dislikes ?? row.totalDislikes ?? 0),
        totalViews: Number(row.total_views ?? row.totalViews ?? 0),
        isActive: Boolean(row.is_active ?? row.isActive),
        createdAt: Number(row.created_at ?? row.createdAt ?? 0),
      },
      topBlocks,
    });
  } catch (err) {
    console.error("[api/v1/topics/[slug]]", err);
    return NextResponse.json({ error: "Failed to fetch topic" }, { status: 500 });
  }
});
