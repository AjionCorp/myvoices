import { Platform } from "@/lib/constants";

export function getVideoUrl(videoId: string, platform: Platform): string {
  switch (platform) {
    case Platform.YouTube:
      return `https://youtube.com/watch?v=${videoId}`;
    case Platform.YouTubeShort:
      return `https://youtube.com/shorts/${videoId}`;
    case Platform.TikTok:
      return `https://www.tiktok.com/@/video/${videoId}`;
  }
}

export function getThumbnailUrl(videoId: string, platform: Platform): string | null {
  switch (platform) {
    case Platform.YouTube:
    case Platform.YouTubeShort:
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    case Platform.TikTok:
      return null;
  }
}

export function getEmbedUrl(videoId: string, platform: Platform): string {
  switch (platform) {
    case Platform.YouTube:
    case Platform.YouTubeShort:
      return `https://www.youtube.com/embed/${videoId}`;
    case Platform.TikTok:
      return `https://www.tiktok.com/embed/v2/${videoId}`;
  }
}
