const TIKTOK_VIDEO_URL_RE = /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i;
const TIKTOK_GENERIC_ID_RE = /(?:vm\.tiktok\.com\/|tiktok\.com\/t\/)([A-Za-z0-9]+)/i;
const TIKTOK_HTML_VIDEO_ID_RE = /video\/(\d+)/i;
const TIKTOK_NUMERIC_VIDEO_ID_RE = /^\d+$/;

export function extractTikTokId(url: string): string | null {
  const videoMatch = url.match(TIKTOK_VIDEO_URL_RE);
  if (videoMatch) return videoMatch[1];
  const genericMatch = url.match(TIKTOK_GENERIC_ID_RE);
  return genericMatch ? genericMatch[1] : null;
}

export function isTikTokUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)tiktok\.com$/i.test(host) || /(^|\.)vm\.tiktok\.com$/i.test(host);
  } catch {
    return false;
  }
}

export function extractTikTokHtmlVideoId(html: string): string | null {
  const match = html.match(TIKTOK_HTML_VIDEO_ID_RE);
  return match ? match[1] : null;
}

export function isTikTokNumericVideoId(value: string): boolean {
  return TIKTOK_NUMERIC_VIDEO_ID_RE.test(value);
}

export function getTikTokWatchUrl(videoId: string): string {
  if (videoId.startsWith("http")) return videoId;
  if (isTikTokNumericVideoId(videoId)) return `https://www.tiktok.com/video/${videoId}`;
  return `https://www.tiktok.com/t/${videoId}`;
}

export function getTikTokEmbedUrl(videoId: string): string {
  return `https://www.tiktok.com/player/v1/${videoId}`;
}
