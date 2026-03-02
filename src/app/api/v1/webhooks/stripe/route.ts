/**
 * Stripe webhook — handles credits purchases.
 *
 * Setup:
 * 1. Go to Stripe Dashboard → Developers → Webhooks → Add endpoint
 * 2. URL: https://yourdomain.com/api/v1/webhooks/stripe
 * 3. Subscribe to: checkout.session.completed
 * 4. Copy the Signing Secret into STRIPE_CREDITS_WEBHOOK_SECRET in .env.local
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe/server";
import Stripe from "stripe";

const WEBHOOK_SECRET =
  process.env.STRIPE_CREDITS_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "";

const SPACETIMEDB_URI =
  (process.env.NEXT_PUBLIC_SPACETIMEDB_URI || "wss://maincloud.spacetimedb.com")
    .replace(/^wss:/, "https:")
    .replace(/^ws:/, "http:");
const SPACETIMEDB_MODULE = process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE || "myvoice";
const SPACETIMEDB_SERVER_TOKEN = process.env.SPACETIMEDB_SERVER_TOKEN ?? "";

async function callReducer(reducerName: string, args: unknown[]): Promise<void> {
  if (!SPACETIMEDB_SERVER_TOKEN) {
    console.warn(`[credits webhook] SPACETIMEDB_SERVER_TOKEN not set — skipping ${reducerName}`);
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
    throw new Error(`SpacetimeDB ${reducerName} failed: ${res.status} ${text}`);
  }
}

export async function POST(request: NextRequest) {
  const stripe = getStripeServer();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  if (!WEBHOOK_SECRET) {
    console.error("[credits webhook] STRIPE_CREDITS_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error("[credits webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      if (metadata?.type !== "credits") {
        // Not a credits checkout — ignore silently
        return NextResponse.json({ received: true });
      }

      const identity = metadata.identity ?? "";
      const credits = parseInt(metadata.credits ?? "0", 10);
      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : "";

      if (!identity || credits <= 0) {
        console.error("[credits webhook] Invalid metadata:", { identity, credits: metadata.credits });
        return NextResponse.json({ received: true });
      }

      console.log("[credits webhook] Credits purchase completed:", {
        identity,
        credits,
        amountCents: session.amount_total,
        paymentIntent: paymentIntentId,
      });

      try {
        await callReducer("add_credits", [
          identity,
          credits,
          paymentIntentId,
          `Purchased ${credits} credits`,
        ]);
        console.log("[credits webhook] add_credits succeeded for", identity, "+", credits);
      } catch (err) {
        console.error("[credits webhook] add_credits failed:", err);
        // Return 500 so Stripe retries the webhook
        return NextResponse.json({ error: "Failed to add credits" }, { status: 500 });
      }
      break;
    }

    default:
      console.log("[credits webhook] Unhandled event:", event.type);
  }

  return NextResponse.json({ received: true });
}
