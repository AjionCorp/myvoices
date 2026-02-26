import { CENTER_X, CENTER_Y, GRID_COLS, GRID_ROWS, isAdSlot } from "@/lib/constants";

/**
 * Raw spiral walker. Call advance() to step to the next position.
 * Does NOT skip ad slots — use spiralCoordinateSkipAds for that.
 */
class SpiralWalker {
  private rx = 0;
  private ry = 0;
  private dx = 1;
  private dy = 0;
  private segLen = 1;
  private segPassed = 0;
  private turns = 0;

  /** Current absolute grid position */
  get x() { return CENTER_X + this.rx; }
  get y() { return CENTER_Y + this.ry; }

  advance() {
    this.rx += this.dx;
    this.ry += this.dy;
    this.segPassed++;
    if (this.segPassed === this.segLen) {
      this.segPassed = 0;
      const tmp = this.dx;
      this.dx = -this.dy;
      this.dy = tmp;
      this.turns++;
      if (this.turns % 2 === 0) this.segLen++;
    }
  }
}

/**
 * Generates (x, y) coordinates in a rectangular spiral from center outward.
 * Index 0 = center, index 1 = right of center, spiraling clockwise.
 * Does NOT skip ad slots.
 */
export function spiralCoordinate(index: number): { x: number; y: number } {
  const w = new SpiralWalker();
  for (let i = 0; i < index; i++) w.advance();
  return { x: w.x, y: w.y };
}

/**
 * Like spiralCoordinate, but skips positions reserved for ads.
 * Index 0 gets the first non-ad spiral position (usually center).
 */
export function spiralCoordinateSkipAds(index: number): { x: number; y: number } {
  const w = new SpiralWalker();
  let placed = 0;
  // Check position 0 (center)
  if (!isAdSlot(w.x, w.y)) {
    if (placed === index) return { x: w.x, y: w.y };
    placed++;
  }
  // Walk outward
  for (let safety = 0; safety < 2_000_000; safety++) {
    w.advance();
    if (isAdSlot(w.x, w.y)) continue;
    if (!isInBounds(w.x, w.y)) continue;
    if (placed === index) return { x: w.x, y: w.y };
    placed++;
  }
  return { x: CENTER_X, y: CENTER_Y };
}

/**
 * Pre-computes spiral coordinates (skipping ads) for a batch.
 * Walks the spiral once incrementally — O(n) instead of O(n^2).
 */
export function batchSpiralCoordinates(
  count: number
): Array<{ x: number; y: number }> {
  const coords: Array<{ x: number; y: number }> = [];
  if (count <= 0) return coords;

  const w = new SpiralWalker();

  // Check position 0 (center)
  if (!isAdSlot(w.x, w.y) && isInBounds(w.x, w.y)) {
    coords.push({ x: w.x, y: w.y });
    if (coords.length >= count) return coords;
  }

  for (let safety = 0; safety < 2_000_000; safety++) {
    w.advance();
    if (isAdSlot(w.x, w.y)) continue;
    if (!isInBounds(w.x, w.y)) continue;
    coords.push({ x: w.x, y: w.y });
    if (coords.length >= count) return coords;
  }

  return coords;
}

export function isInBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

/**
 * Converts a grid (col, row) to a flat block ID.
 */
export function gridToId(x: number, y: number): number {
  return y * GRID_COLS + x;
}

/**
 * Converts a flat block ID to grid (col, row).
 */
export function idToGrid(id: number): { x: number; y: number } {
  return {
    x: id % GRID_COLS,
    y: Math.floor(id / GRID_COLS),
  };
}
