import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripeServer(): Stripe {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
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
}): Promise<string> {
  const s = getStripeServer();
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
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/admin/ads?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/admin/ads?canceled=true`,
  });
  return session.url || "";
}

export async function createConnectedAccount(email: string): Promise<{
  accountId: string;
  onboardingUrl: string;
}> {
  const s = getStripeServer();
  const account = await s.accounts.create({
    type: "express",
    email,
    capabilities: {
      transfers: { requested: true },
    },
  });

  const link = await s.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile?refresh=true`,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile?onboarded=true`,
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
}): Promise<string> {
  const tier = CREDITS_TIERS.find((t) => t.credits === params.credits);
  const priceCents = tier?.priceCents ?? params.credits * 10; // fallback: 10¢/credit

  const s = getStripeServer();
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
    success_url: params.successUrl ?? `${process.env.NEXT_PUBLIC_BASE_URL}/profile?credits=success`,
    cancel_url: params.cancelUrl ?? `${process.env.NEXT_PUBLIC_BASE_URL}/profile?credits=canceled`,
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
