/**
 * SpacetimeDB viewport-based subscription helpers.
 *
 * Provides utilities for computing which blocks are visible and
 * subscribing to viewport-scoped queries when the full grid is
 * too large to subscribe to at once.
 *
 * Block table uses x = column, y = row. Use tileWidth for x-axis and tileHeight for y-axis.
 */

import { getConnection } from "./client";
import { TILE_WIDTH, TILE_HEIGHT } from "@/lib/constants";

const SAFE_MAX = 10000;

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Large bounds covering any realistic topic spiral. */
export function getFullGridBounds(): ViewportBounds {
  return { minX: -SAFE_MAX, maxX: SAFE_MAX, minY: -SAFE_MAX, maxY: SAFE_MAX };
}

/**
 * Compute subscription bounds from viewport pixel coordinates.
 * Uses tileWidth for x (column) and tileHeight for y (row) for non-square tiles.
 */
export function computeSubscriptionBounds(
  viewportX: number,
  viewportY: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
  tileWidth: number = TILE_WIDTH,
  tileHeight: number = TILE_HEIGHT,
  buffer: number = 2
): ViewportBounds {
  const worldW = viewportWidth / zoom;
  const worldH = viewportHeight / zoom;
  const worldX = -viewportX / zoom;
  const worldY = -viewportY / zoom;

  return {
    minX: Math.floor(worldX / tileWidth) - buffer,
    maxX: Math.ceil((worldX + worldW) / tileWidth) + buffer,
    minY: Math.floor(worldY / tileHeight) - buffer,
    maxY: Math.ceil((worldY + worldH) / tileHeight) + buffer,
  };
}

/**
 * Subscribe to blocks within the given viewport bounds using a raw
 * SQL query.  Returns a SubscriptionHandle that can be unsubscribed
 * when the viewport changes.
 */
export function subscribeToViewport(bounds: ViewportBounds, conn = getConnection()) {
  if (!conn) return null;

  return conn
    .subscriptionBuilder()
    .subscribe([
      `SELECT * FROM block WHERE x >= ${bounds.minX} AND x <= ${bounds.maxX} AND y >= ${bounds.minY} AND y <= ${bounds.maxY}`,
    ]);
}
