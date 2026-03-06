const BILIBILI_HOST_RE = /(^|\.)bilibili\.com$/i;

export function isBiliBiliUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return BILIBILI_HOST_RE.test(url.hostname) || /(^|\.)b23\.tv$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function extractBiliBiliBvid(value: string): string | null {
  const direct = value.match(/(?:bilibili\.com\/video\/)(BV[0-9A-Za-z]+)/i);
  if (direct) return direct[1].replace(/^bv/i, "BV");
  const loose = value.match(/\b(BV[0-9A-Za-z]{10})\b/i);
  return loose ? loose[1].replace(/^bv/i, "BV") : null;
}

export function getBiliBiliWatchUrl(bvid: string): string {
  return `https://www.bilibili.com/video/${bvid}/`;
}

export function getBiliBiliEmbedUrl(bvid: string): string {
  return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=1`;
}
