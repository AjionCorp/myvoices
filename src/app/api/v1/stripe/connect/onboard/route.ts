import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createConnectedAccount } from "@/lib/stripe/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const { accountId, onboardingUrl } = await createConnectedAccount(
      email,
      request.nextUrl.origin
    );

    return NextResponse.json({ accountId, onboardingUrl });
  } catch (err) {
    console.error("Connect onboarding error:", err);
    return NextResponse.json(
      { error: "Failed to create connected account" },
      { status: 500 }
    );
  }
}
