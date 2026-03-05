import { NextRequest, NextResponse } from "next/server";
import { runSql, rowToObject, COMMENT_COLUMNS } from "@/lib/spacetimedb/http-sql";
import { withApiKey } from "@/lib/api-middleware";

export const GET = withApiKey(async (request: NextRequest, context) => {
  const slug = context.params?.slug;
  if (!slug) {
    return NextResponse.json({ error: "Topic slug is required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const blockId = searchParams.get("blockId");
  const limit = Math.max(1, Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200));
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  try {
    // First resolve slug to topic_id
    const topicResults = await runSql(
      `SELECT id FROM topic WHERE slug = '${slug.replace(/'/g, "''")}'`
    );
    const topicRes = topicResults[0];
    if (!topicRes || topicRes.rows.length === 0) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }
    const topicRow = rowToObject(topicRes.rows[0], topicRes.schema, ["id"]);
    const topicId = Number(topicRow.id);

    // Build query — if blockId provided, filter to that block
    let sql: string;
    if (blockId) {
      const blockIdNum = parseInt(blockId, 10);
      if (!Number.isFinite(blockIdNum) || blockIdNum <= 0) {
        return NextResponse.json({ error: "Invalid blockId" }, { status: 400 });
      }
      sql = `SELECT * FROM comment WHERE block_id = ${blockIdNum}`;
    } else {
      // Get all block IDs for this topic, then fetch comments
      // SpacetimeDB doesn't support JOINs, so we do a two-step approach
      const blockResults = await runSql(
        `SELECT id FROM block WHERE topic_id = ${topicId}`
      );
      const blockRes = blockResults[0];
      if (!blockRes || blockRes.rows.length === 0) {
        return NextResponse.json({ comments: [], total: 0 });
      }

      const blockIds = blockRes.rows.map((r) => {
        const obj = rowToObject(r, blockRes.schema, ["id"]);
        return Number(obj.id);
      });

      // SpacetimeDB doesn't support IN — use OR chains (limit to first 50 blocks)
      const limited = blockIds.slice(0, 50);
      const orClause = limited.map((id) => `block_id = ${id}`).join(" OR ");
      sql = `SELECT * FROM comment WHERE ${orClause}`;
    }

    const commentResults = await runSql(sql);
    const commentRes = commentResults[0];

    const allComments: Array<Record<string, unknown>> = [];
    if (commentRes) {
      for (const row of commentRes.rows) {
        const obj = rowToObject(row, commentRes.schema, COMMENT_COLUMNS);
        const parentRaw = obj.parent_comment_id ?? obj.parentCommentId;
        const repostRaw = obj.repost_of_id ?? obj.repostOfId;
        allComments.push({
          id: Number(obj.id ?? 0),
          blockId: Number(obj.block_id ?? obj.blockId ?? 0),
          userIdentity: String(obj.user_identity ?? obj.userIdentity ?? ""),
          userName: String(obj.user_name ?? obj.userName ?? ""),
          text: String(obj.text ?? ""),
          createdAt: Number(obj.created_at ?? obj.createdAt ?? 0),
          parentCommentId: parentRaw != null ? Number(parentRaw) : null,
          repostOfId: repostRaw != null ? Number(repostRaw) : null,
          likesCount: Number(obj.likes_count ?? obj.likesCount ?? 0),
          repliesCount: Number(obj.replies_count ?? obj.repliesCount ?? 0),
          repostsCount: Number(obj.reposts_count ?? obj.repostsCount ?? 0),
        });
      }
    }

    // Sort by createdAt desc
    allComments.sort((a, b) => (b.createdAt as number) - (a.createdAt as number));

    // Paginate
    const total = allComments.length;
    const paginated = allComments.slice(offset, offset + limit);

    return NextResponse.json({
      comments: paginated,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[api/v1/topics/[slug]/comments]", err);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
});