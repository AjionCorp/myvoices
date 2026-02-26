export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QuadItem {
  id: number;
  x: number;
  y: number;
}

const MAX_ITEMS = 16;
const MAX_DEPTH = 12;

export class QuadTree {
  private items: QuadItem[] = [];
  private children: QuadTree[] | null = null;

  constructor(
    private bounds: Rect,
    private depth: number = 0
  ) {}

  insert(item: QuadItem): void {
    if (!this.contains(item)) return;

    if (this.children) {
      for (const child of this.children) {
        child.insert(item);
      }
      return;
    }

    this.items.push(item);

    if (this.items.length > MAX_ITEMS && this.depth < MAX_DEPTH) {
      this.subdivide();
    }
  }

  query(range: Rect, result: QuadItem[] = []): QuadItem[] {
    if (!this.intersects(range)) return result;

    if (this.children) {
      for (const child of this.children) {
        child.query(range, result);
      }
      return result;
    }

    for (const item of this.items) {
      if (
        item.x >= range.x &&
        item.x < range.x + range.width &&
        item.y >= range.y &&
        item.y < range.y + range.height
      ) {
        result.push(item);
      }
    }
    return result;
  }

  clear(): void {
    this.items = [];
    this.children = null;
  }

  private subdivide(): void {
    const { x, y, width, height } = this.bounds;
    const hw = width / 2;
    const hh = height / 2;
    const d = this.depth + 1;

    this.children = [
      new QuadTree({ x, y, width: hw, height: hh }, d),
      new QuadTree({ x: x + hw, y, width: hw, height: hh }, d),
      new QuadTree({ x, y: y + hh, width: hw, height: hh }, d),
      new QuadTree({ x: x + hw, y: y + hh, width: hw, height: hh }, d),
    ];

    for (const item of this.items) {
      for (const child of this.children) {
        child.insert(item);
      }
    }
    this.items = [];
  }

  private contains(item: QuadItem): boolean {
    return (
      item.x >= this.bounds.x &&
      item.x < this.bounds.x + this.bounds.width &&
      item.y >= this.bounds.y &&
      item.y < this.bounds.y + this.bounds.height
    );
  }

  private intersects(range: Rect): boolean {
    return !(
      range.x >= this.bounds.x + this.bounds.width ||
      range.x + range.width <= this.bounds.x ||
      range.y >= this.bounds.y + this.bounds.height ||
      range.y + range.height <= this.bounds.y
    );
  }
}
