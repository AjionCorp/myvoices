import { NextResponse } from "next/server";
import { runSql, rowToObject } from "@/lib/spacetimedb/http-sql";

const TOPIC_COLUMNS = [
  "id", "slug", "title", "description", "category", "creator_identity",
  "video_count", "total_likes", "total_dislikes", "total_views", "is_active", "created_at",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTopic(row: Record<string, unknown>): any {
  return {
    id: Number(row.id),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    category: String(row.category ?? ""),
    creatorIdentity: String(row.creator_identity ?? ""),
    videoCount: Number(row.video_count ?? 0),
    totalLikes: Number(row.total_likes ?? 0),
    totalDislikes: Number(row.total_dislikes ?? 0),
    totalViews: Number(row.total_views ?? 0),
    isActive: Boolean(row.is_active),
    createdAt: Number(row.created_at ?? 0),
  };
}

export async function GET() {
  try {
    const results = await runSql("SELECT * FROM topic");
    const topics: ReturnType<typeof mapTopic>[] = [];

    const res = results[0];
    if (res) {
      for (const row of res.rows) {
        const obj = rowToObject(row, res.schema, TOPIC_COLUMNS);
        topics.push(mapTopic(obj));
      }
    }

    return NextResponse.json({ topics });
  } catch (err) {
    console.error("[api/v1/topics] SpacetimeDB fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch topics" },
      { status: 500 }
    );
  }
}
