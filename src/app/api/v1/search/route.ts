import { NextRequest, NextResponse } from "next/server";
import { runSql, rowToObject } from "@/lib/spacetimedb/http-sql";
import { withApiKey } from "@/lib/api-middleware";

const TOPIC_COLUMNS = ["id", "slug", "title", "description", "category", "video_count", "total_likes", "total_views"];
const USER_COLUMNS = ["identity", "username", "display_name", "bio"];

export const GET = withApiKey(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "Query must be at most 200 characters" }, { status: 400 });
  }

  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
  const limit = Math.max(1, Math.min(Number.isNaN(rawLimit) ? 20 : rawLimit, 50));
  // SpacetimeDB SQL doesn't support LIKE with %, so we fetch all and filter server-side
  const qLower = q.toLowerCase();

  try {
    const [topicResults, userResults] = await Promise.all([
      runSql("SELECT id, slug, title, description, category, video_count, total_likes, total_views FROM topic"),
      runSql("SELECT identity, username, display_name, bio FROM user_profile"),
    ]);

    const topicRows = topicResults[0]?.rows ?? [];
    const topics = topicRows
      .map((r) => rowToObject(r, topicResults[0]?.schema, TOPIC_COLUMNS))
      .filter((t) => {
        const title = String(t.title || "").toLowerCase();
        const desc = String(t.description || "").toLowerCase();
        const slug = String(t.slug || "").toLowerCase();
        return title.includes(qLower) || desc.includes(qLower) || slug.includes(qLower);
      })
      .slice(0, limit)
      .map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        description: t.description,
        category: t.category,
        videoCount: t.video_count,
        totalLikes: t.total_likes,
        totalViews: t.total_views,
      }));

    const userRows = userResults[0]?.rows ?? [];
    const users = userRows
      .map((r) => rowToObject(r, userResults[0]?.schema, USER_COLUMNS))
      .filter((u) => {
        const username = String(u.username || "").toLowerCase();
        const displayName = String(u.display_name || "").toLowerCase();
        const bio = String(u.bio || "").toLowerCase();
        return username.includes(qLower) || displayName.includes(qLower) || bio.includes(qLower);
      })
      .slice(0, limit)
      .map((u) => ({
        identity: u.identity,
        username: u.username,
        displayName: u.display_name,
        bio: u.bio,
      }));

    return NextResponse.json({ query: q, topics, users });
  } catch (err) {
    console.error("[api/v1/search]", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
});
