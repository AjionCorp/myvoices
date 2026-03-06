import Stripe from "stripe";

let stripe: Stripe | null = null;

function resolveBaseUrl(baseUrl?: string): string {
  const resolved = baseUrl || process.env.NEXT_PUBLIC_BASE_URL;
  if (!resolved) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_BASE_URL must be set in production");
    }
    return "http://localhost:3000";
  }
  return resolved;
}

export function getStripeServer(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  if (!stripe) {
    stripe = new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return stripe;
}

export async function createCheckoutSession(params: {
  blockIds: number[];
  imageUrl: string;
  linkUrl: string;
  durationDays: number;
  customerEmail?: string;
  baseUrl?: string;
}): Promise<string> {
  const s = getStripeServer();
  const baseUrl = resolveBaseUrl(params.baseUrl);
  const session = await s.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Ad Placement (${params.blockIds.length} blocks, ${params.durationDays} days)`,
            description: `Blocks: ${params.blockIds.slice(0, 10).join(", ")}${params.blockIds.length > 10 ? "..." : ""}`,
          },
          unit_amount: params.blockIds.length * 100 * params.durationDays,
        },
        quantity: 1,
      },
    ],
    metadata: {
      blockIds: JSON.stringify(params.blockIds),
      imageUrl: params.imageUrl,
      linkUrl: params.linkUrl,
      durationDays: String(params.durationDays),
    },
    customer_email: params.customerEmail,
    success_url: `${baseUrl}/admin/ads?success=true`,
    cancel_url: `${baseUrl}/admin/ads?canceled=true`,
  });
  return session.url || "";
}

export async function createConnectedAccount(
  email: string,
  baseUrl?: string
): Promise<{
  accountId: string;
  onboardingUrl: string;
}> {
  const s = getStripeServer();
  const resolvedBaseUrl = resolveBaseUrl(baseUrl);
  const account = await s.accounts.create({
    type: "express",
    email,
    capabilities: {
      transfers: { requested: true },
    },
  });

  const link = await s.accountLinks.create({
    account: account.id,
    refresh_url: `${resolvedBaseUrl}/profile?refresh=true`,
    return_url: `${resolvedBaseUrl}/profile?onboarded=true`,
    type: "account_onboarding",
  });

  return {
    accountId: account.id,
    onboardingUrl: link.url,
  };
}

/** Credits tiers for purchase */
export const CREDITS_TIERS = [
  { credits: 50, priceCents: 500, label: "50 credits" },
  { credits: 250, priceCents: 2000, label: "250 credits" },
  { credits: 1000, priceCents: 5000, label: "1000 credits" },
] as const;

export async function createCreditsCheckoutSession(params: {
  identity: string;
  credits: number;
  successUrl?: string;
  cancelUrl?: string;
  baseUrl?: string;
}): Promise<string> {
  const tier = CREDITS_TIERS.find((t) => t.credits === params.credits);
  const priceCents = tier?.priceCents ?? params.credits * 10; // fallback: 10¢/credit

  const s = getStripeServer();
  const baseUrl = resolveBaseUrl(params.baseUrl);
  const session = await s.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: tier?.label ?? `${params.credits} Credits`,
            description: `Credits for in-app purchases`,
          },
          unit_amount: priceCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "credits",
      identity: params.identity,
      credits: String(params.credits),
    },
    success_url: params.successUrl ?? `${baseUrl}/profile?credits=success`,
    cancel_url: params.cancelUrl ?? `${baseUrl}/profile?credits=canceled`,
  });
  return session.url || "";
}

export async function createPayout(
  connectedAccountId: string,
  amountCents: number,
  description: string
): Promise<string> {
  const s = getStripeServer();
  const transfer = await s.transfers.create({
    amount: amountCents,
    currency: "usd",
    destination: connectedAccountId,
    description,
  });
  return transfer.id;
}
