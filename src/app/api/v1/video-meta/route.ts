import { NextRequest, NextResponse } from "next/server";
import { extractYouTubeId } from "@/lib/utils/youtube";

const metaCache = new Map<string, { data: VideoMeta; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

interface VideoMeta {
  videoId: string;
  title: string;
  author: string;
  channelId: string;
  viewCount: string;
  lengthSeconds: string;
  keywords: string[];
  shortDescription: string;
  thumbnail: { url: string; width: number; height: number };
  isLiveContent: boolean;
  isPrivate: boolean;
  category: string;
  publishDate: string;
  ownerChannelName: string;
  ownerProfileUrl: string;
  isFamilySafe: boolean;
  isShortsEligible: boolean;
  likeCount: string;
}

export async function POST(request: NextRequest) {
  let body: { videoId?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let videoId = body.videoId?.trim() || null;
  if (!videoId && body.url) {
    videoId = extractYouTubeId(body.url.trim());
  }

  if (!videoId || !VIDEO_ID_RE.test(videoId)) {
    return NextResponse.json(
      { error: "Provide a valid YouTube video ID or URL" },
      { status: 400 }
    );
  }

  // Check cache
  const cached = metaCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `YouTube returned ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const match = html.match(
      new RegExp("var\\s+ytInitialPlayerResponse\\s*=\\s*(\\{.+?\\});", "s")
    );

    if (!match) {
      return NextResponse.json(
        { error: "Video unavailable or age-restricted" },
        { status: 404 }
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse YouTube data" },
        { status: 500 }
      );
    }

    const vd = (parsed.videoDetails || {}) as Record<string, unknown>;
    const mf = ((parsed.microformat as Record<string, unknown>)
      ?.playerMicroformatRenderer || {}) as Record<string, unknown>;

    if (vd.isPrivate === true) {
      return NextResponse.json(
        { error: "This video is private" },
        { status: 404 }
      );
    }

    // Pick the best thumbnail
    const thumbs = (vd.thumbnail as Record<string, unknown[]>)?.thumbnails as
      | Array<{ url: string; width: number; height: number }>
      | undefined;
    const bestThumb = thumbs?.[thumbs.length - 1] || {
      url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      width: 480,
      height: 360,
    };

    const data: VideoMeta = {
      videoId,
      title: String(vd.title || ""),
      author: String(vd.author || ""),
      channelId: String(vd.channelId || ""),
      viewCount: String(vd.viewCount || "0"),
      lengthSeconds: String(vd.lengthSeconds || "0"),
      keywords: Array.isArray(vd.keywords) ? (vd.keywords as string[]) : [],
      shortDescription: String(vd.shortDescription || ""),
      thumbnail: bestThumb,
      isLiveContent: vd.isLiveContent === true,
      isPrivate: false,
      category: String(mf.category || ""),
      publishDate: String(mf.publishDate || ""),
      ownerChannelName: String(mf.ownerChannelName || vd.author || ""),
      ownerProfileUrl: String(mf.ownerProfileUrl || ""),
      isFamilySafe: mf.isFamilySafe !== false,
      isShortsEligible: mf.isShortsEligible === true,
      likeCount: String((mf as Record<string, unknown>).likeCount || "0"),
    };

    metaCache.set(videoId, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(data);
  } catch (err) {
    console.error("video-meta scrape error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
