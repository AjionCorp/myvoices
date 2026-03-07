import { NextRequest, NextResponse } from "next/server";
import { runSql, rowToObject } from "@/lib/spacetimedb/http-sql";
import { withApiKey } from "@/lib/api-middleware";

const USER_COLUMNS = [
  "identity", "clerk_user_id", "username", "display_name", "email",
  "stripe_account_id", "total_earnings", "credits", "is_admin", "created_at",
  "bio", "location", "website_url", "social_x", "social_youtube",
  "social_tiktok", "social_instagram",
];

export const GET = withApiKey(async (_request: NextRequest, context) => {
  const username = context.params?.username;
  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  try {
    // Find user by username
    const userResults = await runSql(
      `SELECT * FROM user_profile WHERE username = '${username.replace(/'/g, "''")}'`
    );
    const userRes = userResults[0];
    if (!userRes || userRes.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const row = rowToObject(userRes.rows[0], userRes.schema, USER_COLUMNS);

    // Get follow counts
    const identity = String(row.identity ?? "");
    let followerCount = 0;
    let followingCount = 0;

    try {
      const safeIdentity = identity.replace(/'/g, "''");
      const [followerResults, followingResults] = await Promise.all([
        runSql(`SELECT * FROM user_follow WHERE following_identity = '${safeIdentity}'`),
        runSql(`SELECT * FROM user_follow WHERE follower_identity = '${safeIdentity}'`),
      ]);
      followerCount = followerResults[0]?.rows.length ?? 0;
      followingCount = followingResults[0]?.rows.length ?? 0;
    } catch {
      // Non-fatal
    }

    // Return public fields only — NO email, stripe, earnings, credits, admin, clerk
    const opt = (v: unknown) => {
      if (v == null) return null;
      const s = String(v);
      return s === "" || s === "None" ? null : s;
    };

    return NextResponse.json({
      identity,
      username: String(row.username ?? ""),
      displayName: String(row.display_name ?? row.displayName ?? ""),
      bio: opt(row.bio),
      location: opt(row.location),
      websiteUrl: opt(row.website_url ?? row.websiteUrl),
      socialX: opt(row.social_x ?? row.socialX),
      socialYoutube: opt(row.social_youtube ?? row.socialYoutube),
      socialTiktok: opt(row.social_tiktok ?? row.socialTiktok),
      socialInstagram: opt(row.social_instagram ?? row.socialInstagram),
      createdAt: Number(row.created_at ?? row.createdAt ?? 0),
      followerCount,
      followingCount,
    });
  } catch (err) {
    console.error("[api/v1/users]", err);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
});
