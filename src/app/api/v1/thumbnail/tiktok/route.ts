import { NextRequest, NextResponse } from "next/server";

const thumbnailCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 60 * 1000; // 5 hours (TikTok URLs expire in 6h)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("url");

  if (!videoUrl) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  if (!/tiktok\.com/.test(videoUrl)) {
    return NextResponse.json(
      { error: "Not a TikTok URL" },
      { status: 400 }
    );
  }

  const cached = thumbnailCache.get(videoUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ thumbnailUrl: cached.url });
  }

  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
    const response = await fetch(oembedUrl, {
      headers: { "User-Agent": "myVoice/1.0" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch TikTok metadata" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const thumbnailUrl = data.thumbnail_url;

    if (!thumbnailUrl) {
      return NextResponse.json(
        { error: "No thumbnail found" },
        { status: 404 }
      );
    }

    thumbnailCache.set(videoUrl, {
      url: thumbnailUrl,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json({
      thumbnailUrl,
      title: data.title || "",
      authorName: data.author_name || "",
    });
  } catch (err) {
    console.error("TikTok oEmbed error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
