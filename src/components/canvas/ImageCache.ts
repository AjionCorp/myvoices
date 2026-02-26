const MAX_CACHE = 2000;
const EVICT_BATCH = 400;

interface CacheEntry {
  url: string;
  img: HTMLImageElement;
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
    nodeMap.delete(n.url);
    removed++;
  }
}

export function getCachedImage(url: string): HTMLImageElement | null {
  const n = nodeMap.get(url);
  if (!n) return null;
  promote(n);
  return n.img;
}

export function isLoading(url: string): boolean {
  return loadingUrls.has(url);
}

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (failedUrls.has(url)) return Promise.resolve(null);

  const cached = nodeMap.get(url);
  if (cached) { promote(cached); return Promise.resolve(cached.img); }
  if (loadingUrls.has(url)) return Promise.resolve(null);

  loadingUrls.add(url);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      loadingUrls.delete(url);
      if (nodeMap.size >= MAX_CACHE) evictLRU();
      const node: CacheEntry = { url, img, prev: null, next: head };
      if (head) head.prev = node;
      head = node;
      if (!tail) tail = node;
      nodeMap.set(url, node);
      resolve(img);
    };
    img.onerror = () => {
      loadingUrls.delete(url);
      failedUrls.add(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function getCacheSize(): number { return nodeMap.size; }

export function clearImageCache(): void {
  nodeMap.clear();
  head = null;
  tail = null;
  loadingUrls.clear();
  failedUrls.clear();
}
