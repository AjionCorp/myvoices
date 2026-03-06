import { NextRequest, NextResponse } from "next/server";
import { runSql, rowToObject, BLOCK_COLUMNS, COMMENT_COLUMNS, type SqlResult } from "@/lib/spacetimedb/http-sql";
import { BlockStatus, GRID_COLS, GRID_ROWS, type Platform } from "@/lib/constants";
import { withApiKey } from "@/lib/api-middleware";

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s === "" ? null : s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBlock(row: Record<string, unknown>): any {
  return {
    id: row.id,
    topicId: Number(row.topic_id ?? row.topicId ?? 0),
    x: row.x,
    y: row.y,
    videoId: strOrNull(row.video_id ?? row.videoId),
    platform: strOrNull(row.platform) as Platform | null,
    ownerIdentity: strOrNull(row.owner_identity ?? row.ownerIdentity),
    ownerName: strOrNull(row.owner_name ?? row.ownerName),
    likes: Number(row.likes ?? 0),
    dislikes: Number(row.dislikes ?? 0),
    ytViews: Number(row.yt_views ?? row.ytViews ?? 0),
    ytLikes: Number(row.yt_likes ?? row.ytLikes ?? 0),
    thumbnailUrl: strOrNull(row.thumbnail_url ?? row.thumbnailUrl),
    status: (row.status as BlockStatus) ?? BlockStatus.Empty,
    adImageUrl: strOrNull(row.ad_image_url ?? row.adImageUrl),
    adLinkUrl: strOrNull(row.ad_link_url ?? row.adLinkUrl),
    claimedAt: (() => { const v = row.claimed_at ?? row.claimedAt; return v != null ? Number(v) : null; })(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComment(row: Record<string, unknown>): any {
  const parentRaw = row.parent_comment_id ?? row.parentCommentId;
  const repostRaw = row.repost_of_id ?? row.repostOfId;
  return {
    id: Number(row.id ?? 0),
    blockId: Number(row.block_id ?? row.blockId ?? 0),
    userIdentity: String(row.user_identity ?? row.userIdentity ?? ""),
    userName: String(row.user_name ?? row.userName ?? ""),
    text: String(row.text ?? ""),
    createdAt: Number(row.created_at ?? row.createdAt ?? 0),
    parentCommentId: parentRaw != null ? Number(parentRaw) : null,
    repostOfId: repostRaw != null ? Number(repostRaw) : null,
    likesCount: Number(row.likes_count ?? row.likesCount ?? 0),
    repliesCount: Number(row.replies_count ?? row.repliesCount ?? 0),
    repostsCount: Number(row.reposts_count ?? row.repostsCount ?? 0),
  };
}

export const GET = withApiKey(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const minX = searchParams.get("minX");
    const maxX = searchParams.get("maxX");
    const minY = searchParams.get("minY");
    const maxY = searchParams.get("maxY");
    const topicIdParam = searchParams.get("topicId");

    const hasViewport =
      minX != null && maxX != null && minY != null && maxY != null &&
      minX !== "" && maxX !== "" && minY !== "" && maxY !== "";

    const conditions: string[] = [];
    if (topicIdParam) {
      const topicIdNum = parseInt(topicIdParam, 10);
      if (!Number.isFinite(topicIdNum)) {
        return NextResponse.json({ error: "Invalid topicId" }, { status: 400 });
      }
      conditions.push(`topic_id = ${topicIdNum}`);
    }
    if (hasViewport) {
      const minXN = parseInt(minX!, 10);
      const maxXN = parseInt(maxX!, 10);
      const minYN = parseInt(minY!, 10);
      const maxYN = parseInt(maxY!, 10);
      if (!Number.isFinite(minXN) || !Number.isFinite(maxXN) || !Number.isFinite(minYN) || !Number.isFinite(maxYN)) {
        return NextResponse.json({ error: "Invalid viewport params" }, { status: 400 });
      }
      conditions.push(
        `x >= ${Math.max(0, minXN)}`,
        `x <= ${Math.min(GRID_COLS - 1, maxXN)}`,
        `y >= ${Math.max(0, minYN)}`,
        `y <= ${Math.min(GRID_ROWS - 1, maxYN)}`,
      );
    }
    const blockWhere = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    const blockPromise = runSql(`SELECT * FROM block${blockWhere}`);
    const commentPromise = hasViewport
      ? Promise.resolve([] as SqlResult[])
      : runSql("SELECT * FROM comment");

    const [blockResults, commentResults] = await Promise.all([blockPromise, commentPromise]);

    const blocks: ReturnType<typeof mapBlock>[] = [];
    const comments: ReturnType<typeof mapComment>[] = [];

    const blockRes = blockResults[0];
    if (blockRes) {
      for (const row of blockRes.rows) {
        const obj = rowToObject(row, blockRes.schema, BLOCK_COLUMNS);
        blocks.push(mapBlock(obj));
      }
    }

    const commentRes = commentResults[0];
    if (commentRes) {
      for (const row of commentRes.rows) {
        const obj = rowToObject(row, commentRes.schema, COMMENT_COLUMNS);
        comments.push(mapComment(obj));
      }
    }

    return NextResponse.json({ blocks, comments });
  } catch (err) {
    console.error("[api/v1/data] SpacetimeDB fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
});
