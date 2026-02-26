const TIKTOK_REGEX =
  /(?:tiktok\.com\/@[\w.-]+\/video\/|tiktok\.com\/t\/|vm\.tiktok\.com\/)(\w+)/;

export function extractTikTokId(url: string): string | null {
  const match = url.match(TIKTOK_REGEX);
  return match ? match[1] : null;
}

export function isTikTokUrl(url: string): boolean {
  return /tiktok\.com/.test(url);
}

export function getTikTokEmbedUrl(videoId: string): string {
  return `https://www.tiktok.com/embed/v2/${videoId}`;
}
