import { NextRequest, NextResponse } from "next/server";
import { runSql, rowToObject, BLOCK_COLUMNS, COMMENT_COLUMNS } from "@/lib/spacetimedb/http-sql";
import { BlockStatus, type Platform } from "@/lib/constants";
import { withApiKey } from "@/lib/api-middleware";

interface MappedBlock {
  id: number;
  topicId: number;
  x: number;
  y: number;
  videoId: string | null;
  platform: Platform | null;
  ownerIdentity: string | null;
  ownerName: string | null;
  likes: number;
  dislikes: number;
  ytViews: number;
  ytLikes: number;
  thumbnailUrl: string | null;
  status: BlockStatus;
  adImageUrl: string | null;
  adLinkUrl: string | null;
  claimedAt: number | null;
}

interface MappedComment {
  id: number;
  blockId: number;
  userIdentity: string;
  userName: string;
  text: string;
  createdAt: number;
  parentCommentId: number | null;
  repostOfId: number | null;
  likesCount: number;
  repliesCount: number;
  repostsCount: number;
}

const SAFE_VIEWPORT_LIMIT = 10_000;
const COMMENT_BLOCK_CHUNK_SIZE = 50;

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s === "" ? null : s;
}

function mapBlock(row: Record<string, unknown>): MappedBlock {
  return {
    id: Number(row.id ?? 0),
    topicId: Number(row.topic_id ?? row.topicId ?? 0),
    x: Number(row.x ?? 0),
    y: Number(row.y ?? 0),
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

function mapComment(row: Record<string, unknown>): MappedComment {
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

async function fetchCommentsForBlockIds(blockIds: number[]) {
  if (blockIds.length === 0) return [];

  const chunks: number[][] = [];
  for (let i = 0; i < blockIds.length; i += COMMENT_BLOCK_CHUNK_SIZE) {
    chunks.push(blockIds.slice(i, i + COMMENT_BLOCK_CHUNK_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map((chunk) => {
      const where = chunk.map((id) => `block_id = ${id}`).join(" OR ");
      return runSql(`SELECT * FROM comment WHERE ${where}`);
    })
  );

  return chunkResults.flatMap((results) => {
    const first = results[0];
    return first ? [first] : [];
  });
}

export const GET = withApiKey(async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
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
      if (minXN > maxXN || minYN > maxYN) {
        return NextResponse.json({ error: "Invalid viewport range" }, { status: 400 });
      }
      conditions.push(
        `x >= ${Math.max(-SAFE_VIEWPORT_LIMIT, minXN)}`,
        `x <= ${Math.min(SAFE_VIEWPORT_LIMIT, maxXN)}`,
        `y >= ${Math.max(-SAFE_VIEWPORT_LIMIT, minYN)}`,
        `y <= ${Math.min(SAFE_VIEWPORT_LIMIT, maxYN)}`,
      );
    }
    const blockWhere = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    const blockResults = await runSql(`SELECT * FROM block${blockWhere}`);
    const blocks: MappedBlock[] = [];
    const comments: MappedComment[] = [];

    const blockRes = blockResults[0];
    if (blockRes) {
      for (const row of blockRes.rows) {
        const obj = rowToObject(row, blockRes.schema, BLOCK_COLUMNS);
        blocks.push(mapBlock(obj));
      }
    }

    const shouldScopeComments = hasViewport || topicIdParam != null;
    const blockIds = [...new Set(blocks.map((b) => b.id))];
    const commentResults = shouldScopeComments
      ? await fetchCommentsForBlockIds(blockIds)
      : await runSql("SELECT * FROM comment");

    for (const commentRes of commentResults) {
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
