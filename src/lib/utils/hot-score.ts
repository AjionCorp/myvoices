/**
 * Reddit-style "hot" ranking algorithm with time decay.
 *
 * Scores content higher when it has more net engagement AND is newer.
 * Based on Reddit's ranking: log10(max(|score|, 1)) + sign(score) * (created / 45000)
 *
 * Adapted for myVoice:
 * - Uses net likes (likes - dislikes) as the score signal
 * - Time component: seconds since epoch / 45000 (~12.5 hour half-life)
 * - YouTube metrics (ytViews, ytLikes) included as a boost
 */

/** Hot score for a video block. Higher = more prominent. */
export function hotScoreBlock(
  likes: number,
  dislikes: number,
  ytViews: number,
  ytLikes: number,
  claimedAtMicros: number,
): number {
  const net = (likes - dislikes) + Math.floor(Math.max(ytViews, ytLikes) / 100);
  const magnitude = Math.log10(Math.max(Math.abs(net), 1));
  const sign = net > 0 ? 1 : net < 0 ? -1 : 0;
  // Convert microseconds to seconds since epoch
  const epochSeconds = claimedAtMicros / 1_000_000;
  // 45000 seconds ≈ 12.5 hours — same constant Reddit uses
  return magnitude + sign * (epochSeconds / 45000);
}

/** Hot score for a topic. Based on recent activity + engagement. */
export function hotScoreTopic(
  totalLikes: number,
  totalDislikes: number,
  totalViews: number,
  videoCount: number,
  createdAtMicros: number,
): number {
  const net = (totalLikes - totalDislikes) + Math.floor(totalViews / 50);
  const magnitude = Math.log10(Math.max(Math.abs(net), 1));
  const sign = net > 0 ? 1 : net < 0 ? -1 : 0;
  const epochSeconds = createdAtMicros / 1_000_000;
  // Slight boost for topic with more videos (community activity signal)
  const activityBoost = Math.log10(Math.max(videoCount, 1)) * 0.5;
  return magnitude + activityBoost + sign * (epochSeconds / 45000);
}
