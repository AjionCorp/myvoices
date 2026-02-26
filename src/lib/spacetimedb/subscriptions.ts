/**
 * SpacetimeDB viewport-based subscription helpers.
 *
 * Provides utilities for computing which blocks are visible and
 * subscribing to viewport-scoped queries when the full grid is
 * too large to subscribe to at once.
 *
 * NOTE: The initial implementation in SpacetimeDBProvider subscribes
 * to ALL rows in the block table.  Once performance requires it,
 * swap to viewport-scoped SQL subscriptions using these helpers:
 *
 *   conn.subscriptionBuilder()
 *     .subscribe(`SELECT * FROM block WHERE x >= ${bounds.minX} AND x <= ${bounds.maxX} AND y >= ${bounds.minY} AND y <= ${bounds.maxY}`)
 */

import { getConnection } from "./client";

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function computeSubscriptionBounds(
  viewportX: number,
  viewportY: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
  tileSize: number,
  buffer: number = 2
): ViewportBounds {
  const worldW = viewportWidth / zoom;
  const worldH = viewportHeight / zoom;
  const worldX = -viewportX / zoom;
  const worldY = -viewportY / zoom;

  return {
    minX: Math.floor(worldX / tileSize) - buffer,
    maxX: Math.ceil((worldX + worldW) / tileSize) + buffer,
    minY: Math.floor(worldY / tileSize) - buffer,
    maxY: Math.ceil((worldY + worldH) / tileSize) + buffer,
  };
}

/**
 * Subscribe to blocks within the given viewport bounds using a raw
 * SQL query.  Returns a SubscriptionHandle that can be unsubscribed
 * when the viewport changes.
 */
export function subscribeToViewport(bounds: ViewportBounds) {
  const conn = getConnection();
  if (!conn) return null;

  return conn
    .subscriptionBuilder()
    .subscribe(
      `SELECT * FROM block WHERE x >= ${bounds.minX} AND x <= ${bounds.maxX} AND y >= ${bounds.minY} AND y <= ${bounds.maxY}`
    );
}
