import { NextRequest, NextResponse } from "next/server";
import { createPayout } from "@/lib/stripe/server";

export async function POST(request: NextRequest) {
  try {
    const { connectedAccountId, amountCents, description } =
      await request.json();

    if (!connectedAccountId || !amountCents) {
      return NextResponse.json(
        { error: "connectedAccountId and amountCents are required" },
        { status: 400 }
      );
    }

    const transferId = await createPayout(
      connectedAccountId,
      amountCents,
      description || "myVoice contest prize payout"
    );

    return NextResponse.json({ transferId });
  } catch (err) {
    console.error("Payout error:", err);
    return NextResponse.json(
      { error: "Failed to process payout" },
      { status: 500 }
    );
  }
}
