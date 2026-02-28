/**
 * Stripe webhook template for credits purchases.
 *
 * Setup:
 * 1. Create a webhook in Stripe Dashboard pointing to this endpoint
 * 2. Set STRIPE_CREDITS_WEBHOOK_SECRET (or reuse STRIPE_WEBHOOK_SECRET with metadata-based routing)
 * 3. Add a `credits` column to user_profile and an `add_credits` reducer in your SpacetimeDB module
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe/server";
import Stripe from "stripe";

const WEBHOOK_SECRET =
  process.env.STRIPE_CREDITS_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(request: NextRequest) {
  const stripe = getStripeServer();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  if (!WEBHOOK_SECRET) {
    console.error("[credits webhook] STRIPE_CREDITS_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET not set");
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
        return NextResponse.json({ received: true });
      }

      const identity = metadata.identity;
      const credits = parseInt(metadata.credits ?? "0", 10);

      if (!identity || credits <= 0) {
        console.error("[credits webhook] Invalid metadata:", { identity, credits: metadata.credits });
        return NextResponse.json({ received: true });
      }

      console.log("[credits webhook] Credits purchase completed:", {
        identity,
        credits,
        amount: session.amount_total,
        paymentIntent: session.payment_intent,
      });

      // TODO: Call SpacetimeDB reducer to credit the user.
      // Option A: Use spacetime call CLI from server (requires SPACETIMEDB_TOKEN or similar)
      //   await exec('spacetime call add_credits', [identity, String(credits)]);
      // Option B: Use SpacetimeDB JS SDK with server-side connection (service token)
      //   const conn = await connectWithServiceToken();
      //   await conn.reducers.addCredits(identity, credits);
      // Option C: Use SpacetimeDB Procedures (beta) with HTTP callback

      break;
    }

    default:
      console.log("[credits webhook] Unhandled event:", event.type);
  }

  return NextResponse.json({ received: true });
}
