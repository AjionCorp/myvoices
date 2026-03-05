import { NextRequest, NextResponse } from "next/server";
import { runSql } from "@/lib/spacetimedb/http-sql";
import { withApiKey } from "@/lib/api-middleware";

export const GET = withApiKey(async (_request: NextRequest) => {
  try {
    const [topicResults, blockResults, userResults, commentResults] =
      await Promise.all([
        runSql("SELECT id FROM topic"),
        runSql("SELECT id FROM block WHERE status = 'claimed'"),
        runSql("SELECT identity FROM user_profile"),
        runSql("SELECT id FROM comment"),
      ]);

    return NextResponse.json({
      totalTopics: topicResults[0]?.rows.length ?? 0,
      totalBlocksClaimed: blockResults[0]?.rows.length ?? 0,
      totalUsers: userResults[0]?.rows.length ?? 0,
      totalComments: commentResults[0]?.rows.length ?? 0,
    });
  } catch (err) {
    console.error("[api/v1/stats]", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
});
