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
const WORLD_W = GRID_COLS * TILE_WIDTH;
const WORLD_H = GRID_ROWS * TILE_HEIGHT;

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<ImageData | null>(null);
  const rafRef = useRef(0);
  const lastBlockCountRef = useRef(-1);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldClickX = (mx / MAP_W) * WORLD_W;
      const worldClickY = (my / MAP_H) * WORLD_H;
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

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = MAP_W * dpr;
    canvas.height = MAP_H * dpr;

    const sx = MAP_W / WORLD_W * dpr;
    const sy = MAP_H / WORLD_H * dpr;

    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;
    const w = canvas.width;

    // Fill background dark
    for (let i = 3; i < data.length; i += 4) {
      data[i - 3] = 13; data[i - 2] = 13; data[i - 1] = 13; data[i] = 255;
    }

    // Plot claimed blocks directly into pixel buffer (much faster than fillRect per block)
    const blocks = useBlocksStore.getState().blocks;
    blocks.forEach((b) => {
      if (b.status !== "claimed") return;
      const px = Math.round(b.x * TILE_WIDTH * sx);
      const py = Math.round(b.y * TILE_HEIGHT * sy);
      if (px >= 0 && px < w && py >= 0 && py < canvas.height) {
        const off = (py * w + px) * 4;
        data[off] = 139; data[off + 1] = 92; data[off + 2] = 246; data[off + 3] = 180;
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

      // Check if blocks changed
      const blockCount = useBlocksStore.getState().blocks.size;
      if (blockCount !== lastBlockCountRef.current) {
        lastBlockCountRef.current = blockCount;
        rebuildBg();
      }

      // Restore cached background
      if (bgImageRef.current) {
        ctx.putImageData(bgImageRef.current, 0, 0);
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.save();
      ctx.scale(dpr, dpr);

      const sx = MAP_W / WORLD_W;
      const sy = MAP_H / WORLD_H;

      // Viewer dots
      const viewers = useViewersStore.getState().viewers;
      for (const v of viewers) {
        ctx.beginPath();
        ctx.arc(v.worldX * sx, v.worldY * sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = v.color;
        ctx.fill();
      }

      // Viewport rectangle
      const { viewportX, viewportY, zoom, screenWidth, screenHeight } = useCanvasStore.getState();
      const vx = (-viewportX / zoom) * sx;
      const vy = (-viewportY / zoom) * sy;
      const vw = (screenWidth / zoom) * sx;
      const vh = (screenHeight / zoom) * sy;

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
