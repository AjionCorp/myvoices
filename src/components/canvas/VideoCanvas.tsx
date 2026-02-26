"use client";

import { useRef, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useBlocksStore, type Block } from "@/stores/blocks-store";
import {
  TILE_WIDTH, TILE_HEIGHT, GRID_COLS, GRID_ROWS, isAdSlot,
} from "@/lib/constants";
import { TileRenderer, cropUV, type ImgTile, type SolidTile } from "./TileRenderer";
import { getCachedImage, loadImage } from "./ImageCache";

const HOVER_SCALE = 1.08;
const PRESS_SCALE = 0.95;
const ANIM_SPEED = 0.18;

// LOD: screen pixels per tile height at current zoom
const LOD_LOAD_IMAGES = 6;
const LOD_SKIP_EMPTY = 2;
const MAX_LOADS_PER_FRAME = 8;
const MAX_VISIBLE_TILES = 8000;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// Pre-allocated arrays reused every frame — zero GC pressure
const imgTiles: ImgTile[] = [];
const solidTiles: SolidTile[] = [];

export function VideoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const vp = useRef({ x: 0, y: 0, z: 0.6, sw: 0, sh: 0 });
  const blocksRef = useRef<Map<number, Block>>(new Map());

  const mouseScreen = useRef({ x: -9999, y: -9999, inside: false });
  const hoveredCell = useRef({ col: -1, row: -1, id: -1 });
  const pressedId = useRef(-1);
  const isDragging = useRef(false);
  const dragDist = useRef(0);
  const lastPointer = useRef({ x: 0, y: 0 });
  const pinchDist = useRef<number | null>(null);

  const hoverAlpha = useRef(0);
  const scaleMap = useRef(new Map<number, { current: number; target: number }>());
  const pendingLoads = useRef(new Set<string>());

  const { panBy, zoomBy, setScreenSize, setDragging, selectBlock, openSubmissionModal } = useCanvasStore();

  useEffect(() => {
    const unsub1 = useCanvasStore.subscribe((s) => {
      const v = vp.current;
      v.x = s.viewportX; v.y = s.viewportY; v.z = s.zoom;
      v.sw = s.screenWidth; v.sh = s.screenHeight;
    });
    const unsub2 = useBlocksStore.subscribe((s) => {
      blocksRef.current = s.blocks;
    });
    const cs = useCanvasStore.getState();
    vp.current = { x: cs.viewportX, y: cs.viewportY, z: cs.zoom, sw: cs.screenWidth, sh: cs.screenHeight };
    blocksRef.current = useBlocksStore.getState().blocks;
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new TileRenderer(canvas);

    const updateSize = () => {
      renderer.resize();
      setScreenSize(canvas.clientWidth, canvas.clientHeight);
    };
    updateSize();
    const obs = new ResizeObserver(updateSize);
    obs.observe(canvas);

    const frame = () => {
      rafRef.current = requestAnimationFrame(frame);
      renderer.resize();
      const v = vp.current;
      if (!v.sw || !v.sh) return;

      const zoom = v.z;
      const tilePxW = TILE_WIDTH * zoom;
      const tilePxH = TILE_HEIGHT * zoom;

      // --- Visible range with budget cap ---
      const wx = -v.x / zoom, wy = -v.y / zoom;
      const ww = v.sw / zoom, wh = v.sh / zoom;
      let c0 = Math.max(0, (wx / TILE_WIDTH | 0) - 1);
      let c1 = Math.min(GRID_COLS - 1, Math.ceil((wx + ww) / TILE_WIDTH) + 1);
      let r0 = Math.max(0, (wy / TILE_HEIGHT | 0) - 1);
      let r1 = Math.min(GRID_ROWS - 1, Math.ceil((wy + wh) / TILE_HEIGHT) + 1);

      const visW = c1 - c0 + 1;
      const visH = r1 - r0 + 1;
      const totalVis = visW * visH;

      // If too many tiles visible, subsample by stepping
      let step = 1;
      if (totalVis > MAX_VISIBLE_TILES) {
        step = Math.ceil(Math.sqrt(totalVis / MAX_VISIBLE_TILES));
      }

      const canLoadImages = tilePxH >= LOD_LOAD_IMAGES;
      const showEmpty = tilePxH >= LOD_SKIP_EMPTY;

      // --- Hover computation ---
      const ms = mouseScreen.current;
      let hCol = -1, hRow = -1, hId = -1;
      if (ms.inside && !isDragging.current) {
        const mwx = (ms.x - v.x) / zoom;
        const mwy = (ms.y - v.y) / zoom;
        hCol = Math.floor(mwx / TILE_WIDTH);
        hRow = Math.floor(mwy / TILE_HEIGHT);
        if (hCol >= 0 && hCol < GRID_COLS && hRow >= 0 && hRow < GRID_ROWS) {
          hId = hRow * GRID_COLS + hCol;
        } else { hCol = -1; hRow = -1; }
      }

      const prevH = hoveredCell.current;
      if (prevH.id !== hId && prevH.id >= 0) {
        const s = scaleMap.current.get(prevH.id);
        if (s) s.target = 1;
      }
      hoveredCell.current = { col: hCol, row: hRow, id: hId };

      if (hId >= 0) {
        let s = scaleMap.current.get(hId);
        if (!s) { s = { current: 1, target: HOVER_SCALE }; scaleMap.current.set(hId, s); }
        else s.target = pressedId.current === hId ? PRESS_SCALE : HOVER_SCALE;
      }

      const targetAlpha = hId >= 0 ? 1 : 0;
      hoverAlpha.current = Math.abs(hoverAlpha.current - targetAlpha) < 0.02
        ? targetAlpha : lerp(hoverAlpha.current, targetAlpha, ANIM_SPEED);

      for (const [id, s] of scaleMap.current) {
        if (id !== hId && s.target !== 1) s.target = 1;
        const d = Math.abs(s.current - s.target);
        if (d < 0.002) { s.current = s.target; if (s.target === 1) scaleMap.current.delete(id); }
        else s.current = lerp(s.current, s.target, ANIM_SPEED);
      }

      // --- Build tile lists (reuse arrays, zero alloc) ---
      const blocks = blocksRef.current;
      imgTiles.length = 0;
      solidTiles.length = 0;
      let loads = 0;

      for (let row = r0; row <= r1; row += step) {
        for (let col = c0; col <= c1; col += step) {
          const id = row * GRID_COLS + col;
          const block = blocks.get(id);
          const isClaimed = block && block.status !== "empty";

          const url = block?.thumbnailUrl || block?.adImageUrl || null;

          if (url) {
            const img = getCachedImage(url);
            if (img) {
              const sc = scaleMap.current.get(id);
              const [u0, v0, u1, v1] = cropUV(img.naturalWidth, img.naturalHeight);
              imgTiles.push({ col, row, img, scale: sc ? sc.current : 1, u0, v0, u1, v1 });
            } else {
              if (canLoadImages && loads < MAX_LOADS_PER_FRAME && !pendingLoads.current.has(url)) {
                loads++;
                pendingLoads.current.add(url);
                loadImage(url).then(() => pendingLoads.current.delete(url));
              }
              solidTiles.push({ col, row, r: 0.12, g: 0.10, b: 0.14 });
            }
          } else if (isClaimed) {
            if (block.status === "ad") {
              solidTiles.push({ col, row, r: 0.27, g: 0.10, b: 0.42 });
            } else {
              solidTiles.push({ col, row, r: 0.10, g: 0.10, b: 0.12 });
            }
          } else if (isAdSlot(col, row)) {
            solidTiles.push({ col, row, r: 0.20, g: 0.06, b: 0.32 });
          } else if (showEmpty) {
            solidTiles.push({ col, row, r: 0.067, g: 0.067, b: 0.067 });
          }
        }
      }

      // --- Draw: solids first (background), then textured on top ---
      const hoverSc = hId >= 0 ? (scaleMap.current.get(hId)?.current ?? 1) : 1;
      renderer.drawSolid(solidTiles, v.x, v.y, zoom);
      renderer.draw(imgTiles, v.x, v.y, zoom, hCol, hRow, hoverAlpha.current, hoverSc);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      obs.disconnect();
      renderer.destroy();
    };
  }, [setScreenSize]);

  // --- DOM events ---
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(-e.deltaY * 0.001, e.clientX, e.clientY);
    };
    const onPointerEnter = () => { mouseScreen.current.inside = true; };
    const onPointerLeave = () => {
      mouseScreen.current.inside = false;
      hoveredCell.current = { col: -1, row: -1, id: -1 };
      pressedId.current = -1;
    };
    const onMouseMove = (e: MouseEvent) => {
      mouseScreen.current.x = e.clientX;
      mouseScreen.current.y = e.clientY;
    };
    const onDown = (e: PointerEvent) => {
      isDragging.current = false;
      dragDist.current = 0;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      mouseScreen.current.x = e.clientX;
      mouseScreen.current.y = e.clientY;
      const hid = hoveredCell.current.id;
      if (hid >= 0) {
        let s = scaleMap.current.get(hid);
        if (!s) { s = { current: 1, target: PRESS_SCALE }; scaleMap.current.set(hid, s); }
        else s.target = PRESS_SCALE;
        pressedId.current = hid;
      }
    };
    const onMove = (e: PointerEvent) => {
      mouseScreen.current.x = e.clientX;
      mouseScreen.current.y = e.clientY;
      if (!el.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      dragDist.current += Math.abs(dx) + Math.abs(dy);
      if (dragDist.current > 5) {
        isDragging.current = true;
        setDragging(true);
        pressedId.current = -1;
      }
      panBy(dx, dy);
      lastPointer.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      el.releasePointerCapture(e.pointerId);
      const wasDrag = isDragging.current;
      pressedId.current = -1;
      if (!wasDrag && dragDist.current <= 5) {
        const hid = hoveredCell.current.id;
        if (hid >= 0) {
          const block = blocksRef.current.get(hid);
          if (!block || block.status === "empty" || !block.videoUrl) {
            openSubmissionModal(hid);
          } else {
            selectBlock(hid);
          }
        }
      }
      setTimeout(() => { isDragging.current = false; setDragging(false); }, 50);
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchDist.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDist.current !== null) {
        e.preventDefault();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        zoomBy((d - pinchDist.current) * 0.005,
          (e.touches[0].clientX + e.touches[1].clientX) / 2,
          (e.touches[0].clientY + e.touches[1].clientY) / 2);
        pinchDist.current = d;
      }
    };
    const onTouchEnd = () => { pinchDist.current = null; };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerenter", onPointerEnter);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerenter", onPointerEnter);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [panBy, zoomBy, setDragging, openSubmissionModal, selectBlock]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full touch-none"
      style={{ cursor: "grab" }}
    />
  );
}
