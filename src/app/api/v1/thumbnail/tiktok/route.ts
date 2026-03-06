import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL_MS = 5 * 60 * 60 * 1000; // 5 hours — TikTok CDN URLs expire in ~6 h
const MAX_CACHE_SIZE = 200;

type CachedImage = { imageBytes: ArrayBuffer; contentType: string; expiresAt: number };
const imageCache = new Map<string, CachedImage>();

async function fetchAndCacheImage(cacheKey: string, thumbnailUrl: string): Promise<NextResponse> {
  let normalizedUrl = thumbnailUrl;
  if (normalizedUrl.startsWith("//")) normalizedUrl = `https:${normalizedUrl}`;

  const imgResponse = await fetch(normalizedUrl, {
    headers: { "User-Agent": "myVoice/1.0" },
    signal: AbortSignal.timeout(10000),
  });

  if (!imgResponse.ok) {
    return NextResponse.json({ error: "Failed to fetch thumbnail image" }, { status: 502 });
  }

  const contentType = imgResponse.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Thumbnail is not an image" }, { status: 415 });
  }

  const imageBytes = await imgResponse.arrayBuffer();
  if (imageCache.size >= MAX_CACHE_SIZE) {
    imageCache.delete(imageCache.keys().next().value!);
  }
  imageCache.set(cacheKey, { imageBytes, contentType, expiresAt: Date.now() + CACHE_TTL_MS });

  return new NextResponse(imageBytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=14400",
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");
  const videoUrl = searchParams.get("url");

  let canonicalUrl: string;
  let cacheKey: string;

  if (videoId) {
    canonicalUrl = `https://www.tiktok.com/video/${videoId}`;
    cacheKey = videoId;
  } else if (videoUrl) {
    if (!/tiktok\.com/i.test(videoUrl)) {
      return NextResponse.json({ error: "Not a TikTok URL" }, { status: 400 });
    }
    canonicalUrl = videoUrl;
    cacheKey = videoUrl;
  } else {
    return NextResponse.json({ error: "Missing videoId or url parameter" }, { status: 400 });
  }

  const cached = imageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return new NextResponse(cached.imageBytes, {
      status: 200,
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=14400",
      },
    });
  }

  try {
    const oembedResponse = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`,
      { headers: { "User-Agent": "myVoice/1.0" } }
    );

    if (!oembedResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch TikTok metadata" }, { status: 502 });
    }

    const data = await oembedResponse.json() as { thumbnail_url?: string };
    if (!data.thumbnail_url) {
      return NextResponse.json({ error: "No thumbnail found" }, { status: 404 });
    }

    return await fetchAndCacheImage(cacheKey, data.thumbnail_url);
  } catch (err) {
    console.error("TikTok thumbnail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
