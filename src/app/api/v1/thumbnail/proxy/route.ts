import { NextRequest, NextResponse } from "next/server";

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "127.0.0.1" || h === "::1") return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawInput = searchParams.get("url");
  const input = rawInput?.trim() || null;
  if (!input) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const normalizedInput = input.startsWith("//") ? `https:${input}` : input;

  let target: URL;
  try {
    target = new URL(normalizedInput);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!/^https?:$/.test(target.protocol) || isPrivateHost(target.hostname)) {
    return NextResponse.json({ error: "URL is not allowed" }, { status: 400 });
  }

  try {
    const isBiliImageHost = /(^|\.)hdslb\.com$/i.test(target.hostname);
    if (isBiliImageHost && target.protocol === "http:") {
      target.protocol = "https:";
    }

    const headers: Record<string, string> = { "User-Agent": "myVoice/1.0" };
    if (isBiliImageHost) {
      headers.Referer = "https://www.bilibili.com/";
    }

    const upstream = await fetch(target.toString(), {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream responded ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Upstream is not an image" }, { status: 415 });
    }

    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("thumbnail proxy error:", err);
    return NextResponse.json({ error: "Failed to fetch thumbnail" }, { status: 500 });
  }
}
