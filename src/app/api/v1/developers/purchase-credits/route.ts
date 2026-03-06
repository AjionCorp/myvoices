import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, API_CREDIT_TIERS } from "@/lib/api-keys";
import { getStripeServer } from "@/lib/stripe/server";

function resolveBaseUrl(): string {
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_BASE_URL must be set in production");
    }
    return "http://localhost:3000";
  }
  return process.env.NEXT_PUBLIC_BASE_URL;
}

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();
    const tierId = String(body.tier ?? "").trim();

    const tier = API_CREDIT_TIERS.find((t) => t.id === tierId);
    if (!tier) {
      return NextResponse.json(
        {
          error: `Invalid tier. Choose one of: ${API_CREDIT_TIERS.map((t) => t.id).join(", ")}`,
          tiers: API_CREDIT_TIERS,
        },
        { status: 400 }
      );
    }

    const stripe = getStripeServer();
    const baseUrl = resolveBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: apiKey.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${tier.label} — myVOice API`,
              description: `${tier.credits.toLocaleString()} API request credits`,
            },
            unit_amount: tier.priceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "api_credits",
        keyId: String(apiKey.id),
        credits: String(tier.credits),
      },
      success_url: `${baseUrl}/developers?credits=success`,
      cancel_url: `${baseUrl}/developers?credits=canceled`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[developers/purchase-credits]", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

/** GET returns available tiers */
export async function GET() {
  return NextResponse.json({ tiers: API_CREDIT_TIERS });
}
