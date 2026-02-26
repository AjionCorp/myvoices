import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe/server";
import { adPlacementSchema } from "@/lib/utils/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = adPlacementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { blockIds, imageUrl, linkUrl, durationDays } = parsed.data;

    const checkoutUrl = await createCheckoutSession({
      blockIds,
      imageUrl,
      linkUrl,
      durationDays,
      customerEmail: body.email,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error("Checkout session error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
