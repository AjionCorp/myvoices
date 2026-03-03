const RUMBLE_HOST_RE = /(^|\.)rumble\.com$/i;

export function isRumbleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return RUMBLE_HOST_RE.test(url.hostname);
  } catch {
    return false;
  }
}

export function extractRumbleVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    if (!RUMBLE_HOST_RE.test(url.hostname)) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;

    if (parts[0] === "embed" && parts[1]) {
      return parts[1];
    }

    // Typical watch URLs start with "v..." e.g. /v2d1gn4-title.html
    const first = parts[0];
    const watchIdMatch = first.match(/^(v[a-z0-9]+)/i);
    if (watchIdMatch) return watchIdMatch[1];
    return first || null;
  } catch {
    return null;
  }
}

export function getRumbleWatchUrl(videoId: string): string {
  return `https://rumble.com/${videoId}`;
}

export function getRumbleEmbedUrl(videoId: string): string {
  return `https://rumble.com/embed/${videoId}/`;
}
