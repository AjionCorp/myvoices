/**
 * API middleware for key validation and rate limiting.
 * Wraps Next.js route handlers to add optional API key auth.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  checkRateLimit,
  trackUsage,
  FREE_DAILY_LIMIT,
  type ApiKeyRecord,
} from "@/lib/api-keys";

export interface ApiContext {
  apiKey: ApiKeyRecord | null;
}

type RouteHandler = (
  request: NextRequest,
  context: ApiContext & { params?: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a route handler with optional API key validation + rate limiting.
 *
 * - If no `x-api-key` header → passes through (anonymous, existing behavior)
 * - If `x-api-key` present → validates key, checks rate limit, tracks usage
 * - Returns 401 for invalid key, 429 for rate limit exceeded
 * - Adds rate limit headers to response
 */
export function withApiKey(handler: RouteHandler) {
  return async (request: NextRequest, routeContext?: { params?: Promise<Record<string, string>> }) => {
    const rawKey = request.headers.get("x-api-key");

    // No API key → pass through as anonymous
    if (!rawKey) {
      const resolvedParams = routeContext?.params ? await routeContext.params : undefined;
      return handler(request, { apiKey: null, params: resolvedParams });
    }

    // Validate the key
    const apiKey = await validateApiKey(rawKey);
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Invalid or revoked API key",
          docs: "/developers",
        },
        { status: 401 }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(apiKey.id, apiKey.credits);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Purchase credits for more access.",
          limit: FREE_DAILY_LIMIT,
          resetAt: rateLimit.resetAt,
          credits: apiKey.credits,
          purchaseUrl: "/api/v1/developers/purchase-credits",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimit.resetAt),
            "Retry-After": String(Math.max(0, rateLimit.resetAt - Math.floor(Date.now() / 1000))),
          },
        }
      );
    }

    // Track usage
    const endpoint = new URL(request.url).pathname;
    trackUsage(apiKey.id, endpoint, rateLimit.creditsUsed);

    // Resolve params if it's a Promise (Next.js 16 dynamic routes)
    const resolvedParams = routeContext?.params ? await routeContext.params : undefined;

    // Call the actual handler
    const response = await handler(request, { apiKey, params: resolvedParams });

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    response.headers.set("X-RateLimit-Reset", String(rateLimit.resetAt));

    return response;
  };
}
