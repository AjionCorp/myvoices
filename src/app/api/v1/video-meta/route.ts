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

interface YouTubeVideoApiResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      channelId?: string;
      description?: string;
      tags?: string[];
      categoryId?: string;
      publishedAt?: string;
      liveBroadcastContent?: "none" | "live" | "upcoming";
      thumbnails?: {
        maxres?: { url: string; width: number; height: number };
        high?: { url: string; width: number; height: number };
        medium?: { url: string; width: number; height: number };
        default?: { url: string; width: number; height: number };
      };
    };
    contentDetails?: {
      duration?: string;
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
    };
  }>;
}

const categoryCache = new Map<string, string>();

function parseIsoDurationToSeconds(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

async function fetchCategoryName(categoryId: string, apiKey: string): Promise<string> {
  const cached = categoryCache.get(categoryId);
  if (cached) return cached;

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&id=${categoryId}&hl=en_US&key=${apiKey}`
  );
  if (!res.ok) return "";
  const data = await res.json() as { items?: Array<{ snippet?: { title?: string } }> };
  const title = data.items?.[0]?.snippet?.title || "";
  if (title) categoryCache.set(categoryId, title);
  return title;
}

async function fetchVideoMetaUsingApiKey(videoId: string, apiKey: string): Promise<VideoMeta | null> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`
  );
  if (!res.ok) {
    throw new Error(`YouTube API returned ${res.status}`);
  }

  const data = await res.json() as YouTubeVideoApiResponse;
  const item = data.items?.[0];
  if (!item) return null;

  const snippet = item.snippet || {};
  const stats = item.statistics || {};
  const contentDetails = item.contentDetails || {};
  const durationSeconds = parseIsoDurationToSeconds(contentDetails.duration);
  const category = snippet.categoryId
    ? await fetchCategoryName(snippet.categoryId, apiKey)
    : "";

  const thumbnail =
    snippet.thumbnails?.maxres ||
    snippet.thumbnails?.high ||
    snippet.thumbnails?.medium ||
    snippet.thumbnails?.default || {
      url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      width: 480,
      height: 360,
    };

  return {
    videoId,
    title: snippet.title || "",
    author: snippet.channelTitle || "",
    channelId: snippet.channelId || "",
    viewCount: stats.viewCount || "0",
    lengthSeconds: String(durationSeconds),
    keywords: snippet.tags || [],
    shortDescription: snippet.description || "",
    thumbnail,
    isLiveContent: snippet.liveBroadcastContent === "live",
    isPrivate: false,
    category,
    publishDate: snippet.publishedAt || "",
    ownerChannelName: snippet.channelTitle || "",
    ownerProfileUrl: snippet.channelId ? `https://www.youtube.com/channel/${snippet.channelId}` : "",
    isFamilySafe: true,
    // Shorts detection is not explicitly exposed by the API; this heuristic keeps downstream behavior.
    isShortsEligible: durationSeconds > 0 && durationSeconds <= 70,
    likeCount: stats.likeCount || "0",
  };
}

async function fetchVideoMetaByScraping(videoId: string): Promise<VideoMeta | null> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`YouTube scrape returned ${res.status}`);
  }

  const html = await res.text();
  const match = html.match(
    new RegExp("var\\s+ytInitialPlayerResponse\\s*=\\s*(\\{.+?\\});", "s")
  );

  if (!match) return null;

  const parsed = JSON.parse(match[1]) as Record<string, unknown>;
  const vd = (parsed.videoDetails || {}) as Record<string, unknown>;
  const mf = ((parsed.microformat as Record<string, unknown>)
    ?.playerMicroformatRenderer || {}) as Record<string, unknown>;

  if (vd.isPrivate === true) return null;

  const thumbs = (vd.thumbnail as Record<string, unknown[]>)?.thumbnails as
    | Array<{ url: string; width: number; height: number }>
    | undefined;
  const bestThumb = thumbs?.[thumbs.length - 1] || {
    url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    width: 480,
    height: 360,
  };

  return {
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
    const apiKey = process.env.YOUTUBE_API_KEY;
    let data: VideoMeta | null = null;

    // Prefer API key when available, but never hard-fail if missing/broken.
    if (apiKey) {
      try {
        data = await fetchVideoMetaUsingApiKey(videoId, apiKey);
      } catch (err) {
        console.warn("video-meta api failed, falling back to scraping:", err);
      }
    }

    // Internal fallback: scrape YouTube page directly.
    if (!data) {
      data = await fetchVideoMetaByScraping(videoId);
    }

    if (!data) {
      return NextResponse.json(
        { error: "Video not found or unavailable" },
        { status: 404 }
      );
    }

    metaCache.set(videoId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(data);
  } catch (err) {
    console.error("video-meta error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
