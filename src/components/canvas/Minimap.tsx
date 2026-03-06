"use client";

import { useRef, useEffect, useCallback } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useBlocksStore } from "@/stores/blocks-store";
import { useViewersStore } from "@/stores/viewers-store";
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  GRID_COLS,
  GRID_ROWS,
} from "@/lib/constants";

const MAP_W = 180;
const MAP_H = Math.round(MAP_W * ((GRID_ROWS * TILE_HEIGHT) / (GRID_COLS * TILE_WIDTH)));

// Minimum half-range in world-pixels (covers viewer simulation spread of ±150 tiles).
const MIN_HALF_COLS = 150;
const MIN_HALF_W = MIN_HALF_COLS * TILE_WIDTH;
const MIN_HALF_H = MIN_HALF_COLS * TILE_HEIGHT;

interface WorldRange {
  halfW: number;
  halfH: number;
}

/**
 * Derives the world-pixel half-range that fits all content + 15% padding.
 * Always at least MIN_HALF so viewer dots stay visible on empty/small maps.
 */
function computeRange(
  contentBounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }
): WorldRange {
  const PAD = 1.15;
  const halfCols = Math.max(
    MIN_HALF_COLS,
    Math.abs(contentBounds.minCol) * PAD,
    Math.abs(contentBounds.maxCol) * PAD,
  );
  const halfRows = Math.max(
    MIN_HALF_COLS,
    Math.abs(contentBounds.minRow) * PAD,
    Math.abs(contentBounds.maxRow) * PAD,
  );
  return {
    halfW: halfCols * TILE_WIDTH,
    halfH: halfRows * TILE_HEIGHT,
  };
}

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<ImageData | null>(null);
  const rafRef = useRef(0);
  const lastBlockCountRef = useRef(-1);
  // Current world-pixel half-range; updated on every rebuildBg.
  const rangeRef = useRef<WorldRange>({ halfW: MIN_HALF_W, halfH: MIN_HALF_H });

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { halfW, halfH } = rangeRef.current;
      const worldClickX = (mx / MAP_W - 0.5) * halfW * 2;
      const worldClickY = (my / MAP_H - 0.5) * halfH * 2;
      const { zoom, screenWidth, screenHeight } = useCanvasStore.getState();
      useCanvasStore.getState().setViewport(
        screenWidth / 2 - worldClickX * zoom,
        screenHeight / 2 - worldClickY * zoom
      );
    },
    []
  );

  const rebuildBg = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Derive the display range from the actual content extent.
    const { contentBounds, blocks } = useBlocksStore.getState();
    rangeRef.current = computeRange(contentBounds);
    const { halfW, halfH } = rangeRef.current;
    const worldW = halfW * 2;
    const worldH = halfH * 2;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = MAP_W * dpr;
    canvas.height = MAP_H * dpr;

    // Scale factors: world-pixel → canvas-pixel (DPR-aware)
    const sx = (MAP_W / worldW) * dpr;
    const sy = (MAP_H / worldH) * dpr;

    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;
    const cw = canvas.width;
    const ch = canvas.height;

    // Fill background dark
    for (let i = 3; i < data.length; i += 4) {
      data[i - 3] = 13; data[i - 2] = 13; data[i - 1] = 13; data[i] = 255;
    }

    // Plot claimed blocks as 2×2 pixel squares.
    // Grid (0,0) is the world origin — shift by halfW/halfH to center it in the minimap.
    blocks.forEach((b) => {
      if (b.status !== "claimed") return;
      const px = Math.round((b.x * TILE_WIDTH + halfW) * sx);
      const py = Math.round((b.y * TILE_HEIGHT + halfH) * sy);
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const ppx = px + dx;
          const ppy = py + dy;
          if (ppx >= 0 && ppx < cw && ppy >= 0 && ppy < ch) {
            const off = (ppy * cw + ppx) * 4;
            data[off] = 139; data[off + 1] = 92; data[off + 2] = 246; data[off + 3] = 200;
          }
        }
      }
    });

    ctx.putImageData(imgData, 0, 0);
    bgImageRef.current = imgData;
  }, []);

  useEffect(() => {
    rebuildBg();

    const drawFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Rebuild background when block count changes
      const blockCount = useBlocksStore.getState().blocks.size;
      if (blockCount !== lastBlockCountRef.current) {
        lastBlockCountRef.current = blockCount;
        rebuildBg();
      }

      // Restore cached background
      if (bgImageRef.current) {
        ctx.putImageData(bgImageRef.current, 0, 0);
      }

      const { halfW, halfH } = rangeRef.current;
      const worldW = halfW * 2;
      const worldH = halfH * 2;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Viewer dots — worldX/worldY are world-pixels centered at (0,0)
      const viewers = useViewersStore.getState().viewers;
      for (const v of viewers) {
        ctx.beginPath();
        ctx.arc(
          (v.worldX + halfW) * (MAP_W / worldW),
          (v.worldY + halfH) * (MAP_H / worldH),
          3, 0, Math.PI * 2,
        );
        ctx.fillStyle = v.color;
        ctx.fill();
      }

      // Viewport rectangle — top-left world-pixel of the current view
      const { viewportX, viewportY, zoom, screenWidth, screenHeight } = useCanvasStore.getState();
      const worldTLX = -viewportX / zoom;
      const worldTLY = -viewportY / zoom;
      const vx = (worldTLX + halfW) * (MAP_W / worldW);
      const vy = (worldTLY + halfH) * (MAP_H / worldH);
      const vw = (screenWidth / zoom) * (MAP_W / worldW);
      const vh = (screenHeight / zoom) * (MAP_H / worldH);

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(vx, vy, vw, vh);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(vx, vy, vw, vh);

      ctx.restore();
      rafRef.current = requestAnimationFrame(drawFrame);
    };

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [rebuildBg]);

  const viewerCount = useViewersStore((s) => s.viewers.length);

  return (
    <div className="pointer-events-auto absolute bottom-16 left-4 flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-lg border border-border bg-surface/90 shadow-xl backdrop-blur-sm">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          className="block cursor-crosshair"
          style={{ width: MAP_W, height: MAP_H }}
        />
      </div>
      <div className="flex items-center gap-1.5 rounded-md bg-surface/80 px-2 py-1 backdrop-blur-sm">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span className="text-[10px] font-medium text-muted">
          {viewerCount} viewing
        </span>
      </div>
    </div>
  );
}
