import { NextRequest, NextResponse } from "next/server";
import {
  generateApiKey,
  hashApiKey,
  getKeyPrefix,
  callSpacetimeReducer,
  FREE_DAILY_LIMIT,
} from "@/lib/api-keys";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!name || name.length > 100) {
      return NextResponse.json(
        { error: "name is required (1-100 characters)" },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@") || email.length > 200) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 }
      );
    }

    // Generate the API key
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);

    // Register in SpacetimeDB
    await callSpacetimeReducer("server_register_api_key", [
      keyHash,
      keyPrefix,
      name,
      email,
    ]);

    return NextResponse.json({
      apiKey: rawKey,
      keyPrefix,
      message:
        "Save this API key securely — it will not be shown again. " +
        "Include it as the x-api-key header in your requests.",
      docs: "/developers",
      rateLimit: {
        freeDaily: FREE_DAILY_LIMIT,
        purchaseUrl: "/api/v1/developers/purchase-credits",
      },
    });
  } catch (err) {
    console.error("[developers/register]", err);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
