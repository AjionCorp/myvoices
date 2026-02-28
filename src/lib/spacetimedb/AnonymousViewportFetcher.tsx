"use client";

/**
 * Fetches viewport-scoped blocks via HTTP API when the user is not authenticated.
 * Makes at most MAX_ANONYMOUS_FETCHES requests, then shows "Sign in to explore" modal
 * and stops all further fetching. Cache (60s TTL) is used for pan-back.
 */
import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useBlocksStore, type Block as StoreBlock } from "@/stores/blocks-store";
import { useCommentsStore } from "@/stores/comments-store";
import { useAuthStore } from "@/stores/auth-store";
import { computeSubscriptionBounds } from "./subscriptions";
import { BlockStatus, rebuildAdLayout } from "@/lib/constants";

const DEBOUNCE_MS = 500;
const BUFFER = 2;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 30;
const MAX_ANONYMOUS_FETCHES = 3;

// --- LRU cache for viewport data ---

interface CacheEntry {
  blocks: StoreBlock[];
  comments: Array<{
    id: number;
    blockId: number;
    userIdentity: string;
    userName: string;
    text: string;
    createdAt: number;
  }>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const cacheOrder: string[] = [];

function cacheKey(bounds: { minX: number; maxX: number; minY: number; maxY: number }): string {
  return `${bounds.minX}|${bounds.maxX}|${bounds.minY}|${bounds.maxY}`;
}

function getCached(bounds: { minX: number; maxX: number; minY: number; maxY: number }): CacheEntry | null {
  const key = cacheKey(bounds);
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) cache.delete(key);
    return null;
  }
  const idx = cacheOrder.indexOf(key);
  if (idx >= 0) cacheOrder.splice(idx, 1);
  cacheOrder.push(key);
  return entry;
}

function setCached(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  blocks: StoreBlock[],
  comments: Array<{ id: number; blockId: number; userIdentity: string; userName: string; text: string; createdAt: number }>
) {
  while (cache.size >= CACHE_MAX_ENTRIES && cacheOrder.length > 0) {
    cache.delete(cacheOrder.shift()!);
  }
  const key = cacheKey(bounds);
  cache.set(key, { blocks, comments, expiresAt: Date.now() + CACHE_TTL_MS });
  const idx = cacheOrder.indexOf(key);
  if (idx >= 0) cacheOrder.splice(idx, 1);
  cacheOrder.push(key);
}

// --- Stats recompute ---

let statsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedRecomputeStats() {
  if (statsDebounceTimer) return;
  statsDebounceTimer = setTimeout(() => {
    statsDebounceTimer = null;
    const { blocks, setStats, setTopBlocks } = useBlocksStore.getState();
    const claimed: StoreBlock[] = [];
    for (const b of blocks.values()) {
      if (b.status === BlockStatus.Claimed) claimed.push(b);
    }
    rebuildAdLayout(claimed.length);
    const totalLikes = claimed.reduce((sum, b) => sum + b.likes, 0);
    setStats(claimed.length, totalLikes);
    const top = [...claimed]
      .sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes))
      .slice(0, 10);
    setTopBlocks(top);
  }, 200);
}

// --- Component ---

export function AnonymousViewportFetcher() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const fetchCountRef = useRef(0);
  const prevVP = useRef({ x: NaN, y: NaN, z: NaN });
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const applyData = (
      blocks: StoreBlock[],
      comments: Array<{ id: number; blockId: number; userIdentity: string; userName: string; text: string; createdAt: number }>
    ) => {
      if (blocks.length) {
        useBlocksStore.getState().setBlocks(blocks);
        debouncedRecomputeStats();
      }
      if (comments.length) {
        useCommentsStore.getState().setComments(comments);
      }
      useBlocksStore.getState().setLoading(false);
      useAuthStore.getState().setLoading(false);
    };

    const stopFetching = () => {
      // Unsubscribe from viewport changes — no more requests will ever be made
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      useCanvasStore.getState().setShowLoginForExploreModal(true);
    };

    const fetchViewport = () => {
      if (fetchCountRef.current >= MAX_ANONYMOUS_FETCHES) {
        stopFetching();
        return;
      }

      const { viewportX, viewportY, zoom, screenWidth, screenHeight } = useCanvasStore.getState();
      const sw = screenWidth || 800;
      const sh = screenHeight || 600;

      const bounds = computeSubscriptionBounds(viewportX, viewportY, sw, sh, zoom, undefined, undefined, BUFFER);

      // Cache hit — serve from cache, don't count against fetch limit
      const cached = getCached(bounds);
      if (cached) {
        applyData(cached.blocks, cached.comments);
        return;
      }

      if (inFlightRef.current) return;
      inFlightRef.current = true;
      fetchCountRef.current += 1;

      const isLastFetch = fetchCountRef.current >= MAX_ANONYMOUS_FETCHES;

      const params = new URLSearchParams({
        minX: String(bounds.minX),
        maxX: String(bounds.maxX),
        minY: String(bounds.minY),
        maxY: String(bounds.maxY),
      });

      fetch(`/api/v1/data?${params}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data: { blocks?: StoreBlock[]; comments?: Array<{ id: number; blockId: number; userIdentity: string; userName: string; text: string; createdAt: number }> }) => {
          inFlightRef.current = false;
          const blocks = data.blocks ?? [];
          const comments = data.comments ?? [];
          setCached(bounds, blocks, comments);
          applyData(blocks, comments);
          if (isLastFetch) stopFetching();
        })
        .catch((err) => {
          inFlightRef.current = false;
          // Don't count failed requests against the limit
          fetchCountRef.current -= 1;
          console.error("[AnonymousViewportFetcher] fetch failed:", err);
          useBlocksStore.getState().setLoading(false);
          useAuthStore.getState().setLoading(false);
        });
    };

    // Initial fetch
    const state = useCanvasStore.getState();
    if (state.screenWidth > 0 && state.screenHeight > 0) {
      prevVP.current = { x: state.viewportX, y: state.viewportY, z: state.zoom };
      fetchViewport();
    }

    // Subscribe — only react to actual viewport/zoom changes
    const unsubscribe = useCanvasStore.subscribe((s) => {
      const { viewportX: x, viewportY: y, zoom: z } = s;
      const prev = prevVP.current;
      if (x === prev.x && y === prev.y && z === prev.z) return;
      prevVP.current = { x, y, z };

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        fetchViewport();
      }, DEBOUNCE_MS);
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return null;
}
