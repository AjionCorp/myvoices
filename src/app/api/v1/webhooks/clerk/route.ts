/**
 * Clerk webhook — handles user lifecycle events.
 *
 * Setup:
 * 1. Go to Clerk Dashboard → Webhooks → Add endpoint
 * 2. URL: https://yourdomain.com/api/v1/webhooks/clerk
 * 3. Subscribe to: user.created, user.updated, user.deleted
 * 4. Copy the Signing Secret into CLERK_WEBHOOK_SECRET in .env.local
 *
 * For local dev: use `npx ngrok http 3000` or Clerk's dashboard tunnel.
 */

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET ?? "";

const SPACETIMEDB_URI =
  (process.env.NEXT_PUBLIC_SPACETIMEDB_URI || "wss://maincloud.spacetimedb.com")
    .replace(/^wss:/, "https:")
    .replace(/^ws:/, "http:");
const SPACETIMEDB_MODULE = process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE || "myvoice";
const SPACETIMEDB_SERVER_TOKEN = process.env.SPACETIMEDB_SERVER_TOKEN ?? "";

interface ClerkUserEvent {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    email_addresses: Array<{ email_address: string; id: string }>;
    primary_email_address_id: string | null;
    deleted?: boolean;
  };
}

async function callReducer(reducerName: string, args: unknown[]): Promise<void> {
  if (!SPACETIMEDB_SERVER_TOKEN) {
    console.warn(`[clerk webhook] SPACETIMEDB_SERVER_TOKEN not set — skipping ${reducerName} call`);
    return;
  }

  const url = `${SPACETIMEDB_URI}/v1/database/${SPACETIMEDB_MODULE}/call/${reducerName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SPACETIMEDB_SERVER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SpacetimeDB reducer ${reducerName} failed: ${res.status} ${text}`);
  }
}

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("[clerk webhook] CLERK_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const svixId = request.headers.get("svix-id") ?? "";
  const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
  const svixSignature = request.headers.get("svix-signature") ?? "";

  let event: ClerkUserEvent;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch (err) {
    console.error("[clerk webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;

  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  )?.email_address ?? "";
  const displayName =
    [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
    data.username ||
    primaryEmail ||
    "User";

  switch (type) {
    case "user.created":
      // Profile is created on first WebSocket connect via registerUser reducer.
      console.log("[clerk webhook] user.created:", data.id, { displayName, primaryEmail });
      break;

    case "user.updated": {
      console.log("[clerk webhook] user.updated:", data.id, { displayName, primaryEmail });
      try {
        await callReducer("server_update_profile", [data.id, displayName, primaryEmail]);
        console.log("[clerk webhook] server_update_profile succeeded for", data.id);
      } catch (err) {
        // Non-fatal: user may not have connected yet (no clerk_identity_map entry).
        // The profile will be synced on their next login via updateProfile in onConnect.
        console.warn("[clerk webhook] server_update_profile failed (user may not have logged in yet):", err);
      }
      break;
    }

    case "user.deleted":
      console.log("[clerk webhook] user.deleted:", data.id);
      // Not deleting SpacetimeDB data — destructive and irreversible.
      // Consider anonymising the profile instead.
      break;

    default:
      console.log("[clerk webhook] unhandled event:", type);
  }

  return NextResponse.json({ received: true });
}
