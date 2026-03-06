/**
 * Returns a human-readable relative time string from a microsecond Unix timestamp.
 * Format: "just now", "5m ago", "3h ago", "2d ago"
 */
export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts / 1000) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Returns a compact relative time string from a microsecond Unix timestamp.
 * Format: "now", "5m", "3h", "2d"
 */
export function timeAgoCompact(ts: number): string {
  const s = Math.floor((Date.now() - ts / 1000) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
