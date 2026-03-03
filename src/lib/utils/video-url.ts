import { Platform } from "@/lib/constants";
import { getBiliBiliEmbedUrl, getBiliBiliWatchUrl } from "@/lib/utils/bilibili";
import { getRumbleEmbedUrl, getRumbleWatchUrl } from "@/lib/utils/rumble";
import { getTikTokEmbedUrl, getTikTokWatchUrl, isTikTokNumericVideoId } from "@/lib/utils/tiktok";

function proxiedThumbnailUrl(raw: string): string {
  if (raw.startsWith("/api/v1/thumbnail/proxy?url=")) return raw;
  return `/api/v1/thumbnail/proxy?url=${encodeURIComponent(raw)}`;
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
  if (storedThumbnailUrl) return proxiedThumbnailUrl(storedThumbnailUrl);

  switch (platform) {
    case Platform.YouTube:
    case Platform.YouTubeShort:
      return proxiedThumbnailUrl(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`);
    case Platform.TikTok:
    case Platform.Rumble:
    case Platform.BiliBili:
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
