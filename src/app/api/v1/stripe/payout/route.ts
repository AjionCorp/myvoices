import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPayout } from "@/lib/stripe/server";

function isAdminUserId(userId: string): boolean {
  const adminIds = process.env.ADMIN_CLERK_USER_IDS;
  if (!adminIds) return false;
  return adminIds.split(",").map((id) => id.trim()).includes(userId);
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminUserId(userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
