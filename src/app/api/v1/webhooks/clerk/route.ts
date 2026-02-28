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
import { Webhook } from "standardwebhooks";

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET ?? "";

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

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("[clerk webhook] CLERK_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const webhookId = request.headers.get("webhook-id") ?? "";
  const webhookTimestamp = request.headers.get("webhook-timestamp") ?? "";
  const webhookSignature = request.headers.get("webhook-signature") ?? "";

  let event: ClerkUserEvent;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    event = wh.verify(body, {
      "webhook-id": webhookId,
      "webhook-timestamp": webhookTimestamp,
      "webhook-signature": webhookSignature,
    }) as ClerkUserEvent;
  } catch (err) {
    console.error("[clerk webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;

  switch (type) {
    case "user.created":
      // User registered in Clerk — their SpacetimeDB profile is created on
      // first WebSocket connect (SpacetimeDBProvider.onConnect → register_user).
      // Nothing to do here unless you need server-side pre-provisioning.
      console.log("[clerk webhook] user.created:", data.id);
      break;

    case "user.updated": {
      // Sync Clerk profile changes → SpacetimeDB display_name / email.
      // Requires a server-side SpacetimeDB connection with a service token.
      // TODO: implement if profile sync is needed.
      const primaryEmail = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id
      )?.email_address ?? "";
      const displayName = [data.first_name, data.last_name].filter(Boolean).join(" ")
        || data.username
        || primaryEmail
        || "User";
      console.log("[clerk webhook] user.updated:", data.id, { displayName, primaryEmail });
      // TODO: call SpacetimeDB reducer update_profile(identity, displayName, email)
      break;
    }

    case "user.deleted":
      // User deleted their Clerk account — clean up SpacetimeDB data.
      // WARNING: this is destructive. Consider anonymising instead of deleting.
      console.log("[clerk webhook] user.deleted:", data.id);
      // TODO: call SpacetimeDB reducer delete_user(identity)
      // The SpacetimeDB identity is derived from the Clerk user ID (JWT sub claim).
      // You cannot derive it directly here without calling SpacetimeDB's identity API.
      // Recommended: store the mapping clerk_id → spacetimedb_identity in user_profile.
      break;

    default:
      console.log("[clerk webhook] unhandled event:", type);
  }

  return NextResponse.json({ received: true });
}
