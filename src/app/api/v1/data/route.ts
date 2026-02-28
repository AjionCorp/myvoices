import { NextRequest, NextResponse } from "next/server";
import { runSql, rowToObject, BLOCK_COLUMNS, COMMENT_COLUMNS, type SqlResult } from "@/lib/spacetimedb/http-sql";
import { BlockStatus, GRID_COLS, GRID_ROWS, type Platform } from "@/lib/constants";

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s === "" ? null : s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBlock(row: Record<string, unknown>): any {
  return {
    id: row.id,
    x: row.x,
    y: row.y,
    videoId: strOrNull(row.video_id ?? row.videoId),
    platform: strOrNull(row.platform) as Platform | null,
    ownerIdentity: strOrNull(row.owner_identity ?? row.ownerIdentity),
    ownerName: strOrNull(row.owner_name ?? row.ownerName),
    likes: Number(row.likes ?? 0),
    dislikes: Number(row.dislikes ?? 0),
    status: (row.status as BlockStatus) ?? BlockStatus.Empty,
    adImageUrl: strOrNull(row.ad_image_url ?? row.adImageUrl),
    adLinkUrl: strOrNull(row.ad_link_url ?? row.adLinkUrl),
    claimedAt: row.claimed_at ?? row.claimedAt ? Number(row.claimed_at ?? row.claimedAt) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComment(row: Record<string, unknown>): any {
  return {
    id: Number(row.id ?? 0),
    blockId: Number(row.block_id ?? row.blockId ?? 0),
    userIdentity: String(row.user_identity ?? row.userIdentity ?? ""),
    userName: String(row.user_name ?? row.userName ?? ""),
    text: String(row.text ?? ""),
    createdAt: Number(row.created_at ?? row.createdAt ?? 0),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minX = searchParams.get("minX");
    const maxX = searchParams.get("maxX");
    const minY = searchParams.get("minY");
    const maxY = searchParams.get("maxY");

    const hasViewport =
      minX != null && maxX != null && minY != null && maxY != null &&
      minX !== "" && maxX !== "" && minY !== "" && maxY !== "";

    const blockWhere = hasViewport
      ? ` WHERE x >= ${Math.max(0, parseInt(minX, 10))} AND x <= ${Math.min(GRID_COLS - 1, parseInt(maxX, 10))} AND y >= ${Math.max(0, parseInt(minY, 10))} AND y <= ${Math.min(GRID_ROWS - 1, parseInt(maxY, 10))}`
      : "";

    // SpacetimeDB HTTP API does not support multiple statements per request
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
}
