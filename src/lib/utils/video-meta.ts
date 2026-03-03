import { Platform } from "@/lib/constants";

export type ResolvedVideoMeta = {
  platform: Platform;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  canonicalUrl: string;
  embedUrl: string | null;
};

export async function resolveVideoMeta(input: string): Promise<ResolvedVideoMeta> {
  const res = await fetch("/api/v1/video-meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Failed to resolve video metadata." }));
    throw new Error(data.error || "Failed to resolve video metadata.");
  }

  return res.json() as Promise<ResolvedVideoMeta>;
}
