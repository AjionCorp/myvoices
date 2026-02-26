import { spiralCoordinateSkipAds } from "./spiral-layout";

export interface BlockForRebalance {
  id: number;
  likes: number;
  dislikes: number;
  currentX: number;
  currentY: number;
}

/**
 * Assigns new (x, y) positions based on net score (likes - dislikes).
 * Higher net-scored blocks get positions closer to center (lower spiral index).
 * Skips ad-reserved positions.
 */
export function computeGravityLayout(
  blocks: BlockForRebalance[]
): Map<number, { x: number; y: number }> {
  const sorted = [...blocks].sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
  const result = new Map<number, { x: number; y: number }>();

  for (let i = 0; i < sorted.length; i++) {
    const coord = spiralCoordinateSkipAds(i);
    result.set(sorted[i].id, coord);
  }

  return result;
}

/**
 * Computes incremental moves: only blocks that actually change position.
 */
export function computeGravityDelta(
  blocks: BlockForRebalance[]
): Array<{ id: number; fromX: number; fromY: number; toX: number; toY: number }> {
  const newLayout = computeGravityLayout(blocks);
  const moves: Array<{
    id: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }> = [];

  for (const block of blocks) {
    const newPos = newLayout.get(block.id);
    if (newPos && (newPos.x !== block.currentX || newPos.y !== block.currentY)) {
      moves.push({
        id: block.id,
        fromX: block.currentX,
        fromY: block.currentY,
        toX: newPos.x,
        toY: newPos.y,
      });
    }
  }

  return moves;
}
