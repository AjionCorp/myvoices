import { NextRequest, NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe/server";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const stripe = getStripeServer();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      if (metadata?.blockIds) {
        const blockIds = JSON.parse(metadata.blockIds) as number[];
        const imageUrl = metadata.imageUrl || "";
        const linkUrl = metadata.linkUrl || "";

        console.log("Ad payment completed:", {
          blockIds,
          imageUrl,
          linkUrl,
          amount: session.amount_total,
        });

        // SpacetimeDB: mark_ad_paid + place_ad
        // In production, call the SpacetimeDB module here
      }
      break;
    }

    case "payout.paid": {
      const payout = event.data.object as Stripe.Payout;
      console.log("Payout completed:", payout.id, payout.amount);
      break;
    }

    case "payout.failed": {
      const payout = event.data.object as Stripe.Payout;
      console.error("Payout failed:", payout.id, payout.failure_message);
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      console.log("Connected account updated:", account.id, account.charges_enabled);
      break;
    }

    default:
      console.log("Unhandled webhook event:", event.type);
  }

  return NextResponse.json({ received: true });
}
