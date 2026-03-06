import { Platform, THUMBNAIL_CDN_BASE } from "@/lib/constants";
import { getBiliBiliEmbedUrl, getBiliBiliWatchUrl } from "@/lib/utils/bilibili";
import { getRumbleEmbedUrl, getRumbleWatchUrl } from "@/lib/utils/rumble";
import { getTikTokEmbedUrl, getTikTokWatchUrl, isTikTokNumericVideoId } from "@/lib/utils/tiktok";

function proxiedThumbnailUrl(raw: string): string {
  if (raw.startsWith("/api/v1/thumbnail/proxy?url=")) return raw;
  return `/api/v1/thumbnail/proxy?url=${encodeURIComponent(raw)}`;
}

/**
 * Reduce a full thumbnail URL to the minimal string that should be persisted in the DB.
 *
 * - YouTube / TikTok / Rumble: nothing stored — URLs are always re-derived at display time.
 * - BiliBili: strip the CDN host and any @quality suffix, store only the path
 *   (e.g. "bfs/archive/abc123.jpg"). The host is configurable via THUMBNAIL_CDN_BASE.
 */
export function normalizeThumbnailForStorage(
  url: string | null | undefined,
  platform: Platform
): string {
  if (!url) return "";
  switch (platform) {
    case Platform.YouTube:
    case Platform.YouTubeShort:
    case Platform.TikTok:
    case Platform.Rumble:
      return "";
    case Platform.BiliBili: {
      const match = url.match(/hdslb\.com\/(.+?)(?:@[^?]*)?(?:\?.*)?$/i);
      return match ? match[1] : "";
    }
    default:
      return "";
  }
}

export function getVideoUrl(videoId: string, platform: Platform): string {
  switch (platform) {
    case Platform.YouTube:
      return `https://youtube.com/watch?v=${videoId}`;
    case Platform.YouTubeShort:
      return `https://youtube.com/shorts/${videoId}`;
    case Platform.TikTok:
      return getTikTokWatchUrl(videoId);
    case Platform.Rumble:
      if (!videoId.startsWith("http")) return getRumbleWatchUrl(videoId);
      if (videoId.includes("/embed/")) {
        const match = videoId.match(/\/embed\/([^/?]+)/i);
        if (match?.[1]) return getRumbleWatchUrl(match[1]);
      }
      return videoId;
    case Platform.BiliBili:
      return getBiliBiliWatchUrl(videoId);
  }
}

export function getThumbnailUrl(
  videoId: string,
  platform: Platform,
  storedThumbnailUrl?: string | null
): string | null {
  switch (platform) {
    case Platform.YouTube:
    case Platform.YouTubeShort:
      // Always derive from videoId — img.youtube.com is a public CDN, no proxy needed.
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    case Platform.TikTok:
      // Served fresh by the tiktok thumbnail endpoint (handles CDN expiry + caching).
      return `/api/v1/thumbnail/tiktok?videoId=${encodeURIComponent(videoId)}`;

    case Platform.BiliBili: {
      if (!storedThumbnailUrl) return null;
      // Legacy rows / preview: full URL already present — proxy directly.
      if (storedThumbnailUrl.includes("://")) return proxiedThumbnailUrl(storedThumbnailUrl);
      // New format: path-only — reconstruct using the configurable CDN base.
      const base = THUMBNAIL_CDN_BASE[Platform.BiliBili] ?? "https://i0.hdslb.com";
      const path = storedThumbnailUrl.startsWith("/") ? storedThumbnailUrl : `/${storedThumbnailUrl}`;
      return proxiedThumbnailUrl(`${base}${path}`);
    }

    case Platform.Rumble:
      return null;
  }
}

export function getEmbedUrl(videoId: string, platform: Platform): string {
  switch (platform) {
    case Platform.YouTube:
    case Platform.YouTubeShort:
      return `https://www.youtube.com/embed/${videoId}`;
    case Platform.TikTok:
      if (!isTikTokNumericVideoId(videoId)) return "";
      return getTikTokEmbedUrl(videoId);
    case Platform.Rumble:
      return videoId.startsWith("http") ? videoId : getRumbleEmbedUrl(videoId);
    case Platform.BiliBili:
      return getBiliBiliEmbedUrl(videoId);
  }
}
