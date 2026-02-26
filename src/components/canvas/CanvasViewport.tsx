"use client";

import { useCanvasStore } from "@/stores/canvas-store";
import { CENTER_X, CENTER_Y, MIN_ZOOM, MAX_ZOOM } from "@/lib/constants";

export function CanvasViewport() {
  const { zoom, setZoom, centerOnBlock, screenWidth, screenHeight } =
    useCanvasStore();

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="pointer-events-auto absolute bottom-6 right-6 flex flex-col items-center gap-2">
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface/90 p-2 shadow-xl backdrop-blur-sm">
        <button
          onClick={() => setZoom(Math.min(MAX_ZOOM, zoom * 1.3), screenWidth / 2, screenHeight / 2)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-foreground transition-colors hover:bg-surface-light"
          title="Zoom In"
        >
          +
        </button>

        <span className="px-1 text-xs tabular-nums text-muted">
          {zoomPercent}%
        </span>

        <button
          onClick={() => setZoom(Math.max(MIN_ZOOM, zoom * 0.7), screenWidth / 2, screenHeight / 2)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-foreground transition-colors hover:bg-surface-light"
          title="Zoom Out"
        >
          -
        </button>
      </div>

      <button
        onClick={() => centerOnBlock(CENTER_X, CENTER_Y)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface/90 text-sm text-muted shadow-xl backdrop-blur-sm transition-colors hover:bg-surface-light hover:text-foreground"
        title="Center View"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="8" cy="8" r="3" />
          <line x1="8" y1="1" x2="8" y2="4" />
          <line x1="8" y1="12" x2="8" y2="15" />
          <line x1="1" y1="8" x2="4" y2="8" />
          <line x1="12" y1="8" x2="15" y2="8" />
        </svg>
      </button>
    </div>
  );
}
