import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, FREE_DAILY_LIMIT, peekRateLimit } from "@/lib/api-keys";
import { runSql, rowToObject } from "@/lib/spacetimedb/http-sql";

const USAGE_COLUMNS = ["id", "api_key_id", "endpoint", "request_count", "day", "created_at"];

export async function GET(request: NextRequest) {
  const rawKey = request.headers.get("x-api-key");
  if (!rawKey) {
    return NextResponse.json(
      { error: "x-api-key header is required" },
      { status: 401 }
    );
  }

  const apiKey = await validateApiKey(rawKey);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Invalid or revoked API key" },
      { status: 401 }
    );
  }

  // Read quota state without consuming a request
  const rateLimit = peekRateLimit(apiKey.id, apiKey.credits);

  // Get recent usage from DB
  let recentUsage: Array<{ endpoint: string; requestCount: number; day: number }> = [];
  try {
    const results = await runSql(
      `SELECT * FROM api_usage_log WHERE api_key_id = ${apiKey.id}`
    );
    const res = results[0];
    if (res) {
      recentUsage = res.rows.map((row) => {
        const obj = rowToObject(row, res.schema, USAGE_COLUMNS);
        return {
          endpoint: String(obj.endpoint ?? ""),
          requestCount: Number(obj.request_count ?? obj.requestCount ?? 0),
          day: Number(obj.day ?? 0),
        };
      });
      // Sort by day descending, limit to last 30 entries
      recentUsage.sort((a, b) => b.day - a.day);
      recentUsage = recentUsage.slice(0, 30);
    }
  } catch {
    // Non-fatal
  }

  return NextResponse.json({
    keyPrefix: apiKey.keyPrefix,
    name: apiKey.name,
    email: apiKey.email,
    credits: apiKey.credits,
    totalRequests: apiKey.totalRequests,
    isActive: apiKey.isActive,
    createdAt: apiKey.createdAt,
    rateLimit: {
      freeDaily: FREE_DAILY_LIMIT,
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt,
    },
    recentUsage,
  });
}
