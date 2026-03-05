"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useTopicStore } from "@/stores/topic-store";
import { getThumbnailUrl } from "@/lib/utils/video-url";
import { Platform } from "@/lib/constants";
import {
  computeLayout,
  computeBounds,
  CATEGORY_TILE_SIZE,
  TOPIC_TILE_SIZE,
  type SortKey,
} from "@/lib/landing/cluster-layout";
import { CategoryTile } from "./CategoryTile";
import { TopicTile } from "./TopicTile";
import { LandingHUD } from "./LandingHUD";

const ZOOM_MIN = 0.18;
const ZOOM_MAX = 2.2;
const ZOOM_STEP = 0.18;
const MOMENTUM_FRICTION = 0.88;
const MOMENTUM_MIN = 0.4;

// ──────────────────────────────────────────────────────────────
// Viewport helpers
// ──────────────────────────────────────────────────────────────
interface Viewport { x: number; y: number; zoom: number }

function clampZoom(z: number) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

/**
 * Compute a viewport that fits the given pixel bounds inside the screen
 * with optional padding.
 */
function fitViewport(
  bounds: { width: number; height: number; cx: number; cy: number },
  screenW: number,
  screenH: number,
  padding = 80,
): Viewport {
  const usableW = screenW - padding * 2;
  const usableH = screenH - padding * 2;
  const zoom = clampZoom(Math.min(usableW / bounds.width, usableH / bounds.height));
  return {
    zoom,
    x: screenW / 2 - bounds.cx * zoom,
    y: screenH / 2 - bounds.cy * zoom,
  };
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────
export function LandingCanvas() {
  const topics = useTopicStore((s) => s.topics);
  const taxonomyNodes = useTopicStore((s) => s.taxonomyNodes);

  const [topVideos, setTopVideos] = useState<
    Record<number, { videoId: string; platform: string; thumbnailUrl: string | null }>
  >({});
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("hot");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const screenW = useRef(typeof window !== "undefined" ? window.innerWidth : 1280);
  const screenH = useRef(typeof window !== "undefined" ? window.innerHeight : 800);

  // Viewport state — kept in refs for the RAF loop, synced to React state for render
  const vpRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  // Pan momentum
  const velRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  // didDragRef is true from the first pixel of movement through the click event.
  // It is only reset at the START of the next pointerdown, so it's still true
  // when the browser fires the click event that follows pointerup.
  const didDragRef = useRef(false);
  const dragStart = useRef({ px: 0, py: 0, vpX: 0, vpY: 0 });
  const lastPointer = useRef({ x: 0, y: 0, t: 0 });
  const [isDraggingState, setIsDraggingState] = useState(false);

  // ── Thumbnails ──────────────────────────────────────────────
  const topicFingerprint = useMemo(
    () => [...topics.values()].map((t) => `${t.id}:${t.videoCount}`).join(","),
    [topics],
  );

  useEffect(() => {
    if (!topicFingerprint) return;
    fetch("/api/v1/topics")
      .then((r) => r.json())
      .then((d: { topVideos?: typeof topVideos }) => {
        if (d.topVideos) setTopVideos(d.topVideos);
      })
      .catch(() => {});
  }, [topicFingerprint]);

  const thumbnailMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const [idStr, tv] of Object.entries(topVideos)) {
      const url = getThumbnailUrl(tv.videoId, tv.platform as Platform, tv.thumbnailUrl);
      if (url) m.set(Number(idStr), url);
    }
    return m;
  }, [topVideos]);

  // ── Layout ───────────────────────────────────────────────────
  const nodes = useMemo(
    () => computeLayout(topics, taxonomyNodes, thumbnailMap, sortKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topics, taxonomyNodes, thumbnailMap, sortKey],
  );

  const bounds = useMemo(() => computeBounds(nodes), [nodes]);

  // ── Initial fit ──────────────────────────────────────────────
  useEffect(() => {
    if (nodes.length === 0) return;
    // Account for the sticky header (~64px) + HUD bar (~50px) at top
    const topOffset = 120;
    const fit = fitViewport(
      bounds,
      screenW.current,
      screenH.current - topOffset,
      80,
    );
    // Shift down so content doesn't sit behind the header
    fit.y += topOffset;
    vpRef.current = fit;
    setVp(fit);
    if (!ready) setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length > 0]);

  // ── Resize ──────────────────────────────────────────────────
  useEffect(() => {
    function onResize() {
      screenW.current = window.innerWidth;
      screenH.current = window.innerHeight;
    }
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Commit viewport ref → React state ────────────────────────
  const commitVp = useCallback(() => {
    setVp({ ...vpRef.current });
  }, []);

  // ── Momentum RAF loop ────────────────────────────────────────
  const startMomentum = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    function tick() {
      const { x: vx, y: vy } = velRef.current;
      if (Math.abs(vx) < MOMENTUM_MIN && Math.abs(vy) < MOMENTUM_MIN) {
        velRef.current = { x: 0, y: 0 };
        return;
      }
      vpRef.current.x += vx;
      vpRef.current.y += vy;
      velRef.current.x *= MOMENTUM_FRICTION;
      velRef.current.y *= MOMENTUM_FRICTION;
      commitVp();
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [commitVp]);

  // ── Pointer events ──────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // No setPointerCapture — the container is full-viewport so the pointer
    // can never leave it, and capture would redirect pointerup away from
    // child buttons/tiles, breaking their click synthesis.
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    isDragging.current = false;
    didDragRef.current = false;
    dragStart.current = {
      px: e.clientX,
      py: e.clientY,
      vpX: vpRef.current.x,
      vpY: vpRef.current.y,
    };
    lastPointer.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    velRef.current = { x: 0, y: 0 };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) return;
    const dx = e.clientX - dragStart.current.px;
    const dy = e.clientY - dragStart.current.py;
    // 8px threshold — tolerates natural trackpad/touch jitter during clicks
    if (!isDragging.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      isDragging.current = true;
      didDragRef.current = true;
      setIsDraggingState(true);
    }
    if (!isDragging.current) return;

    const dt = e.timeStamp - lastPointer.current.t;
    if (dt > 0) {
      velRef.current.x = (e.clientX - lastPointer.current.x) / dt * 14;
      velRef.current.y = (e.clientY - lastPointer.current.y) / dt * 14;
    }
    lastPointer.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };

    vpRef.current.x = dragStart.current.vpX + dx;
    vpRef.current.y = dragStart.current.vpY + dy;
    commitVp();
  }, [commitVp]);

  const onPointerUp = useCallback(() => {
    const wasDragging = isDragging.current;
    isDragging.current = false;
    setIsDraggingState(false);
    if (wasDragging) startMomentum();
  }, [startMomentum]);

  // ── Wheel / zoom ─────────────────────────────────────────────
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0008);
    const oldZoom = vpRef.current.zoom;
    const newZoom = clampZoom(oldZoom * (1 + delta));
    const pivotX = e.clientX;
    const pivotY = e.clientY;
    // Zoom toward cursor
    vpRef.current.x = pivotX - (pivotX - vpRef.current.x) * (newZoom / oldZoom);
    vpRef.current.y = pivotY - (pivotY - vpRef.current.y) * (newZoom / oldZoom);
    vpRef.current.zoom = newZoom;
    commitVp();
  }, [commitVp]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // ── HUD actions ──────────────────────────────────────────────
  const handleHome = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    velRef.current = { x: 0, y: 0 };
    const topOffset = 120;
    const fit = fitViewport(bounds, screenW.current, screenH.current - topOffset, 80);
    fit.y += topOffset;
    vpRef.current = fit;
    setVp(fit);
  }, [bounds]);

  const handleZoomIn = useCallback(() => {
    // Zoom toward the content centroid (projected to screen space)
    const pivotX = vpRef.current.x + bounds.cx * vpRef.current.zoom;
    const pivotY = vpRef.current.y + bounds.cy * vpRef.current.zoom;
    const oldZoom = vpRef.current.zoom;
    const newZoom = clampZoom(oldZoom + ZOOM_STEP);
    vpRef.current.x = pivotX - (pivotX - vpRef.current.x) * (newZoom / oldZoom);
    vpRef.current.y = pivotY - (pivotY - vpRef.current.y) * (newZoom / oldZoom);
    vpRef.current.zoom = newZoom;
    commitVp();
  }, [commitVp, bounds]);

  const handleZoomOut = useCallback(() => {
    const pivotX = vpRef.current.x + bounds.cx * vpRef.current.zoom;
    const pivotY = vpRef.current.y + bounds.cy * vpRef.current.zoom;
    const oldZoom = vpRef.current.zoom;
    const newZoom = clampZoom(oldZoom - ZOOM_STEP);
    vpRef.current.x = pivotX - (pivotX - vpRef.current.x) * (newZoom / oldZoom);
    vpRef.current.y = pivotY - (pivotY - vpRef.current.y) * (newZoom / oldZoom);
    vpRef.current.zoom = newZoom;
    commitVp();
  }, [commitVp, bounds]);

  const handleCategoryClick = useCallback((name: string) => {
    setActiveCategory((prev) => (prev === name ? null : name));
  }, []);

  // Use the ref (not React state) so the check is synchronous when onClick fires,
  // avoiding the stale-state race between setIsDraggingState(false) and onClick.
  const router = useRouter();
  const handleTopicClick = useCallback((slug: string) => {
    if (!didDragRef.current) {
      router.push(`/t/${slug}`);
    }
  }, [router]);

  // ── Search/filter dim calculation ────────────────────────────
  const lowerSearch = search.toLowerCase();

  const getDimAmount = useCallback(
    (nodeId: string, nodeCatName?: string, topicTitle?: string): number => {
      // Category nodes are never fully dimmed, only reduced
      const isCat = nodeId.startsWith("cat:");

      // Active category filter
      if (activeCategory) {
        if (isCat) {
          return nodeCatName === activeCategory ? 0 : 0.7;
        } else {
          // topics in other categories
          if (nodeCatName !== activeCategory) return 0.85;
        }
      }

      // Search filter — only applies to topics
      if (!isCat && lowerSearch) {
        const matches = topicTitle?.toLowerCase().includes(lowerSearch);
        if (!matches) return 0.82;
      }

      return 0;
    },
    [activeCategory, lowerSearch],
  );

  // ── Global stats ─────────────────────────────────────────────
  const globalStats = useMemo(() => {
    let topicCount = 0;
    let videoCount = 0;
    let viewCount = 0;
    for (const t of topics.values()) {
      if (!t.isActive) continue;
      topicCount++;
      videoCount += t.videoCount;
      viewCount += t.totalViews;
    }
    return { topicCount, videoCount, viewCount };
  }, [topics]);

  // ── Viewport culling ─────────────────────────────────────────
  // We only render tiles whose centres are within screen bounds (with margin).
  const MARGIN = 300; // px in canvas space
  const visibleNodes = useMemo(() => {
    const { x: vx, y: vy, zoom: vz } = vp;
    // screen bounds → canvas bounds
    const left = (-vx - MARGIN) / vz;
    const top = (-vy - MARGIN) / vz;
    const right = (screenW.current - vx + MARGIN) / vz;
    const bottom = (screenH.current - vy + MARGIN) / vz;
    return nodes.filter((n) => n.x >= left && n.x <= right && n.y >= top && n.y <= bottom);
  }, [nodes, vp]);

  // ── Empty / loading states ────────────────────────────────────
  if (!ready && topics.size === 0) {
    return (
      <div style={skeletonWrapStyle}>
        <LandingHUD
          search={search}
          onSearchChange={setSearch}
          sortKey={sortKey}
          onSortChange={setSortKey}
          activeCategory={activeCategory}
          onClearCategory={() => setActiveCategory(null)}
          globalStats={{ topicCount: 0, videoCount: 0, viewCount: 0 }}
          onHome={handleHome}
          zoom={vp.zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: 40, paddingTop: 130 }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i % 7 === 0 ? CATEGORY_TILE_SIZE : TOPIC_TILE_SIZE,
                height: i % 7 === 0 ? CATEGORY_TILE_SIZE : TOPIC_TILE_SIZE,
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                animation: "pulse 1.4s ease-in-out infinite",
                animationDelay: `${(i * 0.07).toFixed(2)}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Canvas transform ─────────────────────────────────────────
  const canvasTransform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        cursor: isDraggingState ? "grabbing" : "default",
        touchAction: "none",
        background: "var(--background)",
      }}
    >
      {/* Background dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: `${Math.max(20, 40 * vp.zoom)}px ${Math.max(20, 40 * vp.zoom)}px`,
          backgroundPosition: `${vp.x % (40 * vp.zoom)}px ${vp.y % (40 * vp.zoom)}px`,
          pointerEvents: "none",
        }}
      />

      {/* Transform container — all tiles live here */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transformOrigin: "0 0",
          transform: canvasTransform,
          willChange: "transform",
        }}
      >
        {visibleNodes.map((node) => {
          const half = node.type === "category" ? CATEGORY_TILE_SIZE / 2 : TOPIC_TILE_SIZE / 2;
          const tileLeft = node.x - half;
          const tileTop = node.y - half;

          if (node.type === "category") {
            const dimAmount = getDimAmount(node.id, node.categoryName);
            const isActive = activeCategory === node.categoryName;
            const isFiltered = activeCategory !== null && !isActive;

            return (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  left: tileLeft,
                  top: tileTop,
                }}
              >
                <CategoryTile
                  name={node.categoryName!}
                  topicCount={node.topicCount!}
                  totalVideos={node.totalVideos!}
                  totalViews={node.totalViews!}
                  totalNetLikes={node.totalNetLikes!}
                  isActive={isActive}
                  isFiltered={isFiltered}
                  zoom={vp.zoom}
                  onClick={() => handleCategoryClick(node.categoryName!)}
                />
              </div>
            );
          }

          // Topic node
          const topic = node.topic!;
          // Determine the top-level category name for this topic node
          const topicCatName = getTopicCategoryName(topic.taxonomyPath, topic.category);
          const dimAmount = getDimAmount(node.id, topicCatName, topic.title);

          return (
            <div
              key={node.id}
              style={{
                position: "absolute",
                left: tileLeft,
                top: tileTop,
              }}
            >
              <TopicTile
                topic={topic}
                thumbnailUrl={node.thumbnailUrl}
                subcategoryName={node.subcategoryName}
                dimAmount={dimAmount}
                zoom={vp.zoom}
                isDragging={isDraggingState}
                onTopicClick={handleTopicClick}
              />
            </div>
          );
        })}
      </div>

      {/* HUD */}
      <LandingHUD
        search={search}
        onSearchChange={setSearch}
        sortKey={sortKey}
        onSortChange={(k) => {
          setSortKey(k);
        }}
        activeCategory={activeCategory}
        onClearCategory={() => setActiveCategory(null)}
        globalStats={globalStats}
        onHome={handleHome}
        zoom={vp.zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function getTopicCategoryName(taxonomyPath: string | undefined, category: string): string {
  if (taxonomyPath) return taxonomyPath.split("/")[0] || category || "General";
  return category || "General";
}

const skeletonWrapStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  overflow: "hidden",
  background: "var(--background)",
};
