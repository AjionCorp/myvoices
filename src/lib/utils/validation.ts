import { z } from "zod";
import { isYouTubeUrl } from "./youtube";
import { isTikTokUrl } from "./tiktok";
import { isBiliBiliUrl } from "./bilibili";
import { isRumbleUrl } from "./rumble";

export const videoUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .refine(
    (url) => isYouTubeUrl(url) || isTikTokUrl(url) || isBiliBiliUrl(url) || isRumbleUrl(url),
    "Must be a YouTube, TikTok, BiliBili, or Rumble URL"
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

export function detectPlatform(
  url: string
): "youtube" | "youtube_short" | "tiktok" | "bilibili" | "rumble" | null {
  if (isBiliBiliUrl(url)) return "bilibili";
  if (isTikTokUrl(url)) return "tiktok";
  if (isRumbleUrl(url)) return "rumble";
  if (isYouTubeUrl(url)) {
    return /youtube\.com\/shorts\//.test(url) ? "youtube_short" : "youtube";
  }
  return null;
}
