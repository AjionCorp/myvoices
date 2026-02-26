import { NextRequest, NextResponse } from "next/server";

const ISSUER = process.env.NEXT_PUBLIC_SPACETIMEAUTH_ISSUER || "";
const CLIENT_ID = process.env.NEXT_PUBLIC_SPACETIMEAUTH_CLIENT_ID || "";
const REDIRECT_URI = process.env.NEXT_PUBLIC_SPACETIMEAUTH_REDIRECT_URI || "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/?auth_error=${error}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/?auth_error=no_code`
    );
  }

  try {
    const tokenResponse = await fetch(`${ISSUER}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error("Token exchange failed:", err);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?auth_error=token_exchange`
      );
    }

    const tokens = await tokenResponse.json();

    const redirectUrl = new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001");
    redirectUrl.searchParams.set("token", tokens.id_token || tokens.access_token);
    if (tokens.refresh_token) {
      redirectUrl.searchParams.set("refresh", tokens.refresh_token);
    }

    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("Auth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/?auth_error=server_error`
    );
  }
}
