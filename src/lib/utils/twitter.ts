const TWITTER_REGEX =
  /(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i;

export function extractTwitterId(url: string): string | null {
  const match = url.match(TWITTER_REGEX);
  return match ? match[1] : null;
}

export function isTwitterUrl(url: string): boolean {
  return TWITTER_REGEX.test(url);
}
