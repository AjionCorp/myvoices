import { NextRequest, NextResponse } from "next/server";
import { Platform } from "@/lib/constants";
import { extractBiliBiliBvid, getBiliBiliEmbedUrl, getBiliBiliWatchUrl } from "@/lib/utils/bilibili";
import {
  extractTikTokHtmlVideoId,
  extractTikTokId,
  getTikTokEmbedUrl,
  isTikTokNumericVideoId,
} from "@/lib/utils/tiktok";
import { extractYouTubeId } from "@/lib/utils/youtube";

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;
const ENABLE_BILIBILI = process.env.ENABLE_BILIBILI !== "false" && process.env.NEXT_PUBLIC_ENABLE_BILIBILI !== "false";

type ResolvedMeta = {
  platform: Platform;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  canonicalUrl: string;
  embedUrl: string | null;
};

const metaCache = new Map<string, { data: ResolvedMeta; expiresAt: number }>();

function isYouTubeShortUrl(value: string): boolean {
  return /youtube\.com\/shorts\//i.test(value);
}

function isTikTokUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return /(^|\.)tiktok\.com$/i.test(host) || /(^|\.)vm\.tiktok\.com$/i.test(host);
  } catch {
    return false;
  }
}

function isBiliBiliUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return /(^|\.)bilibili\.com$/i.test(host) || /(^|\.)b23\.tv$/i.test(host);
  } catch {
    return false;
  }
}

async function resolveYouTube(input: string): Promise<ResolvedMeta | null> {
  const videoId = VIDEO_ID_RE.test(input) ? input : extractYouTubeId(input);
  if (!videoId) return null;
  const platform = isYouTubeShortUrl(input) ? Platform.YouTubeShort : Platform.YouTube;
  const canonicalUrl =
    platform === Platform.YouTubeShort
      ? `https://youtube.com/shorts/${videoId}`
      : `https://youtube.com/watch?v=${videoId}`;
  let title = "";
  try {
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`
    );
    if (oembed.ok) {
      const data = await oembed.json() as { title?: string };
      title = data.title || "";
    }
  } catch {
    // Thumbnail + ID are enough for downstream flow.
  }
  return {
    platform,
    videoId,
    title,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    canonicalUrl,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
  };
}

async function resolveTikTok(url: string): Promise<ResolvedMeta | null> {
  if (!isTikTokUrl(url)) return null;
  let canonicalUrl = url;
  const host = new URL(url).hostname.toLowerCase();
  if (host === "vm.tiktok.com" || host === "tiktok.com" || host === "www.tiktok.com") {
    try {
      const redirectProbe = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 myVoice" },
      });
      if (redirectProbe.url) canonicalUrl = redirectProbe.url;
    } catch {
      // Keep original URL when redirect probing fails.
    }
  }

  const oembed = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`, {
    headers: { "User-Agent": "myVoice/1.0" },
  });
  if (!oembed.ok) return null;
  const data = await oembed.json() as { title?: string; thumbnail_url?: string; html?: string };
  const htmlVideoId = data.html ? extractTikTokHtmlVideoId(data.html) : null;
  const videoIdCandidates = [
    extractTikTokId(canonicalUrl),
    extractTikTokId(url),
    htmlVideoId,
  ].filter((candidate): candidate is string => !!candidate);

  const videoId = videoIdCandidates.find(isTikTokNumericVideoId) ?? null;
  if (!videoId) return null;

  let thumbnailUrl = data.thumbnail_url || null;
  if (thumbnailUrl?.startsWith("//")) thumbnailUrl = `https:${thumbnailUrl}`;
  if (thumbnailUrl?.startsWith("http://")) thumbnailUrl = `https://${thumbnailUrl.slice("http://".length)}`;

  return {
    platform: Platform.TikTok,
    videoId,
    title: data.title || "",
    thumbnailUrl,
    canonicalUrl,
    embedUrl: getTikTokEmbedUrl(videoId),
  };
}

async function resolveBiliBili(rawUrl: string): Promise<ResolvedMeta | null> {
  if (!ENABLE_BILIBILI) return null;
  let finalUrl = rawUrl;
  const host = new URL(rawUrl).hostname;
  if (/(^|\.)b23\.tv$/i.test(host)) {
    try {
      const resp = await fetch(rawUrl, { method: "GET", redirect: "follow" });
      finalUrl = resp.url || rawUrl;
    } catch {
      // Keep original URL when redirect probing fails.
    }
  }
  if (!isBiliBiliUrl(finalUrl)) return null;

  const bvid = extractBiliBiliBvid(finalUrl);
  if (!bvid) return null;

  const res = await fetch(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
    {
      headers: {
        Referer: "https://www.bilibili.com/",
        "User-Agent": "Mozilla/5.0 myVoice",
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json() as { data?: { title?: string; pic?: string } };
  let thumbnailUrl = data.data?.pic || null;
  if (thumbnailUrl?.startsWith("//")) thumbnailUrl = `https:${thumbnailUrl}`;
  if (thumbnailUrl?.startsWith("http://")) thumbnailUrl = `https://${thumbnailUrl.slice("http://".length)}`;
  return {
    platform: Platform.BiliBili,
    videoId: bvid,
    title: data.data?.title || "",
    thumbnailUrl,
    canonicalUrl: getBiliBiliWatchUrl(bvid),
    embedUrl: getBiliBiliEmbedUrl(bvid),
  };
}

export async function POST(request: NextRequest) {
  let body: { input?: string; url?: string; videoId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = (body.input || body.url || body.videoId || "").trim();
  if (!input) {
    return NextResponse.json({ error: "Provide a video URL or ID" }, { status: 400 });
  }

  const cached = metaCache.get(input);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    let resolved: ResolvedMeta | null = null;

    resolved = await resolveYouTube(input);
    if (!resolved) {
      try {
        const parsed = new URL(input);
        const normalized = parsed.toString();
        resolved =
          (await resolveTikTok(normalized)) ||
          (await resolveBiliBili(normalized));
      } catch {
        // Non-URL and non-YouTube-ID input.
      }
    }

    if (!resolved) {
      return NextResponse.json(
        { error: "Unsupported URL. Supported: YouTube, TikTok, BiliBili." },
        { status: 400 }
      );
    }

    if (metaCache.size >= MAX_CACHE_SIZE) {
      // Evict the oldest (first inserted) entry to cap memory usage.
      metaCache.delete(metaCache.keys().next().value!);
    }
    metaCache.set(input, { data: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(resolved);
  } catch (err) {
    console.error("video-meta error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
