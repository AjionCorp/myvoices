import { z } from "zod";
import { isYouTubeUrl } from "./youtube";
import { isTikTokUrl } from "./tiktok";

export const videoUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .refine(
    (url) => isYouTubeUrl(url) || isTikTokUrl(url),
    "Must be a YouTube or TikTok URL"
  );

export const adPlacementSchema = z.object({
  blockIds: z.array(z.number().int().min(0)).min(1),
  imageUrl: z.string().url(),
  linkUrl: z.string().url(),
  durationDays: z.number().int().min(1).max(365),
});

export const contestSchema = z.object({
  prizePool: z.number().positive(),
  durationDays: z.number().int().min(1).max(365),
});

export function detectPlatform(url: string): "youtube" | "youtube_short" | "tiktok" | null {
  if (isTikTokUrl(url)) return "tiktok";
  if (isYouTubeUrl(url)) {
    return /youtube\.com\/shorts\//.test(url) ? "youtube_short" : "youtube";
  }
  return null;
}
