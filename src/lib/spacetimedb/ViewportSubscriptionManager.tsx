"use client";

/**
 * Manages block subscription when NEXT_PUBLIC_VIEWPORT_SUBSCRIPTION_THRESHOLD > 0.
 * In this mode, the client subscribes to all tables except block; this manager creates
 * the block subscription. Uses full grid bounds initially so stats/topBlocks work.
 * Subscribes to canvas store and can update subscription when viewport changes (debounced).
 */
import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import {
  computeSubscriptionBounds,
  getFullGridBounds,
  subscribeToViewport,
  type ViewportBounds,
} from "./subscriptions";
import { VIEWPORT_SUBSCRIPTION_THRESHOLD } from "./client";
import type { DbConnection } from "@/module_bindings";

const DEBOUNCE_MS = 300;

function boundsEqual(a: ViewportBounds, b: ViewportBounds): boolean {
  return a.minX === b.minX && a.maxX === b.maxX && a.minY === b.minY && a.maxY === b.maxY;
}

function boundsUnion(a: ViewportBounds, b: ViewportBounds): ViewportBounds {
  return {
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minY: Math.min(a.minY, b.minY),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function ViewportSubscriptionManager({
  conn,
  blockSubscriptionHandleRef,
}: {
  conn: DbConnection | null;
  blockSubscriptionHandleRef: React.MutableRefObject<{ unsubscribe: () => void } | null>;
}) {
  const prevBoundsRef = useRef<ViewportBounds | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (VIEWPORT_SUBSCRIPTION_THRESHOLD <= 0 || !conn) return;

    const updateSubscription = (bounds: ViewportBounds, expandOnly = false) => {
      const nextBounds = expandOnly && prevBoundsRef.current
        ? boundsUnion(prevBoundsRef.current, bounds)
        : bounds;
      if (prevBoundsRef.current && boundsEqual(prevBoundsRef.current, nextBounds)) return;
      prevBoundsRef.current = nextBounds;

      if (blockSubscriptionHandleRef.current) {
        blockSubscriptionHandleRef.current.unsubscribe();
      }

      const handle = subscribeToViewport(nextBounds, conn);
      if (handle) {
        blockSubscriptionHandleRef.current = handle;
      }
    };

    updateSubscription(getFullGridBounds());

    const unsubscribeCanvas = useCanvasStore.subscribe(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const { viewportX, viewportY, zoom, screenWidth, screenHeight } =
          useCanvasStore.getState();
        const bounds = computeSubscriptionBounds(
          viewportX,
          viewportY,
          screenWidth || 800,
          screenHeight || 600,
          zoom
        );
        updateSubscription(bounds, true);
      }, DEBOUNCE_MS);
    });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unsubscribeCanvas();
      if (blockSubscriptionHandleRef.current) {
        blockSubscriptionHandleRef.current.unsubscribe();
        blockSubscriptionHandleRef.current = null;
      }
    };
  }, [conn, blockSubscriptionHandleRef]);

  return null;
}
