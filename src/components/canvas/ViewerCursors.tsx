"use client";

import { useRef, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useViewersStore } from "@/stores/viewers-store";

interface CursorEl {
  root: HTMLDivElement;
  lastX: number;
  lastY: number;
}

/**
 * Renders viewer cursors via imperative DOM manipulation.
 * No React re-renders on pan/zoom — positions update via RAF.
 */
export function ViewerCursors() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorEls = useRef(new Map<string, CursorEl>());
  const rafRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const frame = () => {
      const { viewportX, viewportY, zoom, screenWidth, screenHeight } = useCanvasStore.getState();
      const { viewers } = useViewersStore.getState();
      const margin = 40;
      const existing = cursorEls.current;
      const seen = new Set<string>();

      for (const v of viewers) {
        seen.add(v.id);
        const sx = v.worldX * zoom + viewportX;
        const sy = v.worldY * zoom + viewportY;
        const visible = sx > -margin && sx < screenWidth + margin &&
                        sy > -margin && sy < screenHeight + margin;

        let el = existing.get(v.id);

        if (!visible) {
          if (el) {
            container.removeChild(el.root);
            existing.delete(v.id);
          }
          continue;
        }

        if (!el) {
          const root = document.createElement("div");
          root.className = "absolute flex items-center gap-1 transition-transform duration-[2500ms] ease-linear pointer-events-none";
          root.innerHTML = `
            <span class="absolute h-5 w-5 animate-ping rounded-full opacity-20" style="background:${v.color}"></span>
            <span class="relative h-3 w-3 rounded-full border border-black/40 shadow-sm" style="background:${v.color}"></span>
            <span class="ml-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white shadow" style="background:${v.color}cc">${v.name}</span>
          `;
          container.appendChild(root);
          el = { root, lastX: sx, lastY: sy };
          existing.set(v.id, el);
        }

        // Only update transform when position changed meaningfully
        if (Math.abs(el.lastX - sx) > 0.5 || Math.abs(el.lastY - sy) > 0.5) {
          el.root.style.transform = `translate(${sx - 6}px, ${sy - 6}px)`;
          el.lastX = sx;
          el.lastY = sy;
        }
      }

      // Remove viewers that are gone
      for (const [id, el] of existing) {
        if (!seen.has(id)) {
          container.removeChild(el.root);
          existing.delete(id);
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafRef.current);
      cursorEls.current.clear();
    };
  }, []);

  return <div ref={containerRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" />;
}
