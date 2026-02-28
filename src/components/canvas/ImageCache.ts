const MAX_CACHE = 6000;
const EVICT_BATCH = 800;
const FADE_MS = 220;

interface CacheEntry {
  url: string;
  img: ImageBitmap;
  loadedAt: number;
  prev: CacheEntry | null;
  next: CacheEntry | null;
}

let head: CacheEntry | null = null;
let tail: CacheEntry | null = null;
const nodeMap = new Map<string, CacheEntry>();
const loadingUrls = new Set<string>();
const failedUrls = new Set<string>();

function promote(n: CacheEntry) {
  if (n === head) return;
  if (n.prev) n.prev.next = n.next;
  if (n.next) n.next.prev = n.prev;
  if (n === tail) tail = n.prev;
  n.prev = null;
  n.next = head;
  if (head) head.prev = n;
  head = n;
  if (!tail) tail = n;
}

function evictLRU() {
  let removed = 0;
  while (tail && removed < EVICT_BATCH) {
    const n = tail;
    tail = n.prev;
    if (tail) tail.next = null; else head = null;
    n.img.close();
    nodeMap.delete(n.url);
    removed++;
  }
}

export interface CachedImage {
  img: ImageBitmap;
  alpha: number;
}

export function getCachedImage(url: string, now: number): CachedImage | null {
  const n = nodeMap.get(url);
  if (!n) return null;
  promote(n);
  const age = now - n.loadedAt;
  const alpha = age >= FADE_MS ? 1 : age / FADE_MS;
  return { img: n.img, alpha };
}

export function isLoading(url: string): boolean {
  return loadingUrls.has(url);
}

export function loadImage(url: string): Promise<ImageBitmap | null> {
  if (failedUrls.has(url)) return Promise.resolve(null);

  const cached = nodeMap.get(url);
  if (cached) { promote(cached); return Promise.resolve(cached.img); }
  if (loadingUrls.has(url)) return Promise.resolve(null);

  loadingUrls.add(url);

  return fetch(url, { mode: "cors" })
    .then((res) => {
      if (!res.ok) throw new Error("fetch failed");
      return res.blob();
    })
    .then((blob) => createImageBitmap(blob))
    .then((bmp) => {
      loadingUrls.delete(url);
      if (nodeMap.size >= MAX_CACHE) evictLRU();
      const node: CacheEntry = { url, img: bmp, loadedAt: performance.now(), prev: null, next: head };
      if (head) head.prev = node;
      head = node;
      if (!tail) tail = node;
      nodeMap.set(url, node);
      return bmp;
    })
    .catch(() => {
      loadingUrls.delete(url);
      failedUrls.add(url);
      return null;
    });
}

export function getCacheSize(): number { return nodeMap.size; }

export function clearImageCache(): void {
  for (const entry of nodeMap.values()) entry.img.close();
  nodeMap.clear();
  head = null;
  tail = null;
  loadingUrls.clear();
  failedUrls.clear();
}
