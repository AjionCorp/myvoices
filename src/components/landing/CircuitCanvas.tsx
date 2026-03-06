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
import { useExploreStore } from "@/stores/explore-store";
import { getThumbnailUrl } from "@/lib/utils/video-url";
import { Platform } from "@/lib/constants";
import {
  computeCircuitLayout,
  computeCircuitBounds,
  computeOverviewBounds,
  CATEGORY_TILE_SIZE,
  TOPIC_TILE_SIZE,
  SECTION_PITCH,
  SECTIONS_PER_ROW,
  SECTION_INNER_W,
  type SortKey,
  type CircuitLayoutNode,
} from "@/lib/landing/circuit-layout";
import { CategoryTile }  from "./CategoryTile";
import { TopicTile }     from "./TopicTile";
import { AdTile }        from "./AdTile";
import { LandingHUD }    from "./LandingHUD";

// ─── Viewport constants ───────────────────────────────────────────────────────
const ZOOM_MIN           = 0.08;
const ZOOM_MAX           = 2.2;
const ZOOM_STEP          = 0.18;
const MOMENTUM_FRICTION  = 0.88;
const MOMENTUM_MIN       = 0.4;
const CULL_MARGIN        = 320;
// Topics marked isDeep are hidden below this zoom — prevents overlap between
// section rows when zoomed out to see all 20 categories.
const DEEP_ZOOM_THRESHOLD = 0.4;

// ─── Viewport helpers ─────────────────────────────────────────────────────────
interface Viewport { x: number; y: number; zoom: number }

function clampZoom(z: number) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

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

// ─── Component ────────────────────────────────────────────────────────────────
export function CircuitCanvas() {
  const topics        = useTopicStore((s) => s.topics);
  const taxonomyNodes = useTopicStore((s) => s.taxonomyNodes);
  const selectedPaths = useExploreStore((s) => s.selectedPaths);

  // Top-video thumbnails fetched from API
  const [topVideos, setTopVideos] = useState<
    Record<number, { videoId: string; platform: string; thumbnailUrl: string | null }>
  >({});

  const [search,         setSearch]         = useState("");
  const [sortKey,        setSortKey]        = useState<SortKey>("hot");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [ready,          setReady]          = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const screenW      = useRef(typeof window !== "undefined" ? window.innerWidth  : 1280);
  const screenH      = useRef(typeof window !== "undefined" ? window.innerHeight : 800);

  // Viewport — ref for RAF, state for React render
  const vpRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [vp,  setVp]  = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  // Pan momentum
  const velRef            = useRef({ x: 0, y: 0 });
  const rafRef            = useRef<number | null>(null);
  const isDragging        = useRef(false);
  const didDragRef        = useRef(false);
  const dragStart         = useRef({ px: 0, py: 0, vpX: 0, vpY: 0 });
  const lastPointer       = useRef({ x: 0, y: 0, t: 0 });
  const [isDraggingState, setIsDraggingState] = useState(false);

  // ── Thumbnail fetch ───────────────────────────────────────────────────────
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

  // ── Layout ────────────────────────────────────────────────────────────────
  const nodes = useMemo(
    () => computeCircuitLayout(topics, taxonomyNodes, thumbnailMap, sortKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topics, taxonomyNodes, thumbnailMap, sortKey],
  );

  // Full bounds (used for lane separator heights and zoom-out limit)
  const bounds = useMemo(() => computeCircuitBounds(nodes), [nodes]);

  // ── Initial fit (overview = first row category tiles + 3 topic rows) ──────
  useEffect(() => {
    if (nodes.length === 0) return;
    const overview   = computeOverviewBounds();
    const topOffset  = 120;
    const fit = fitViewport(overview, screenW.current, screenH.current - topOffset, 40);
    fit.y += topOffset;
    vpRef.current = fit;
    setVp(fit);
    if (!ready) setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length > 0]);

  // ── Resize ────────────────────────────────────────────────────────────────
  useEffect(() => {
    function onResize() {
      screenW.current = window.innerWidth;
      screenH.current = window.innerHeight;
    }
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Commit viewport ref → React state ─────────────────────────────────────
  const commitVp = useCallback(() => { setVp({ ...vpRef.current }); }, []);

  // Cancel any active RAF loop on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Momentum RAF loop ─────────────────────────────────────────────────────
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

  // ── Pointer events ────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    isDragging.current  = false;
    didDragRef.current  = false;
    dragStart.current   = { px: e.clientX, py: e.clientY, vpX: vpRef.current.x, vpY: vpRef.current.y };
    lastPointer.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    velRef.current      = { x: 0, y: 0 };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1)) return;
    const dx = e.clientX - dragStart.current.px;
    const dy = e.clientY - dragStart.current.py;
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
    lastPointer.current     = { x: e.clientX, y: e.clientY, t: e.timeStamp };
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

  // ── Wheel / zoom ──────────────────────────────────────────────────────────
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta   = -e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0008);
    const oldZoom = vpRef.current.zoom;
    const newZoom = clampZoom(oldZoom * (1 + delta));
    const pivotX  = e.clientX;
    const pivotY  = e.clientY;
    vpRef.current.x    = pivotX - (pivotX - vpRef.current.x) * (newZoom / oldZoom);
    vpRef.current.y    = pivotY - (pivotY - vpRef.current.y) * (newZoom / oldZoom);
    vpRef.current.zoom = newZoom;
    commitVp();
  }, [commitVp]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  // `ready` must be included: containerRef.current is null during the skeleton
  // early-return; re-running after ready=true attaches the listener to the canvas div.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onWheel, ready]);

  // ── HUD actions ───────────────────────────────────────────────────────────
  const handleHome = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    velRef.current = { x: 0, y: 0 };
    const overview  = computeOverviewBounds();
    const topOffset = 120;
    const fit = fitViewport(overview, screenW.current, screenH.current - topOffset, 40);
    fit.y += topOffset;
    vpRef.current = fit;
    setVp(fit);
  }, []);

  const handleZoomIn = useCallback(() => {
    const cx      = screenW.current / 2;
    const cy      = screenH.current / 2;
    const oldZoom = vpRef.current.zoom;
    const newZoom = clampZoom(oldZoom + ZOOM_STEP);
    vpRef.current.x    = cx - (cx - vpRef.current.x) * (newZoom / oldZoom);
    vpRef.current.y    = cy - (cy - vpRef.current.y) * (newZoom / oldZoom);
    vpRef.current.zoom = newZoom;
    commitVp();
  }, [commitVp]);

  const handleZoomOut = useCallback(() => {
    const cx      = screenW.current / 2;
    const cy      = screenH.current / 2;
    const oldZoom = vpRef.current.zoom;
    const newZoom = clampZoom(oldZoom - ZOOM_STEP);
    vpRef.current.x    = cx - (cx - vpRef.current.x) * (newZoom / oldZoom);
    vpRef.current.y    = cy - (cy - vpRef.current.y) * (newZoom / oldZoom);
    vpRef.current.zoom = newZoom;
    commitVp();
  }, [commitVp]);

  const router = useRouter();
  const handleTopicClick = useCallback((slug: string) => {
    if (!didDragRef.current) router.push(`/t/${slug}`);
  }, [router]);

  const handleCategoryClick = useCallback((name: string) => {
    setActiveCategory((prev) => (prev === name ? null : name));
  }, []);

  // ── Global stats ──────────────────────────────────────────────────────────
  const globalStats = useMemo(() => {
    let topicCount = 0, videoCount = 0, viewCount = 0;
    for (const t of topics.values()) {
      if (!t.isActive) continue;
      topicCount++;
      videoCount += t.videoCount;
      viewCount  += t.totalViews;
    }
    return { topicCount, videoCount, viewCount };
  }, [topics]);

  // ── Viewport culling ──────────────────────────────────────────────────────
  const visibleNodes = useMemo<CircuitLayoutNode[]>(() => {
    const { x: vx, y: vy, zoom: vz } = vp;
    const left   = (-vx - CULL_MARGIN) / vz;
    const top    = (-vy - CULL_MARGIN) / vz;
    const right  = (screenW.current - vx + CULL_MARGIN) / vz;
    const bottom = (screenH.current - vy + CULL_MARGIN) / vz;
    return nodes.filter((n) => {
      // Hide deep nodes (beyond section row preview) when zoomed out
      if (n.isDeep && vz < DEEP_ZOOM_THRESHOLD) return false;
      const hw = n.w / 2;
      const hh = n.h / 2;
      return n.x + hw >= left && n.x - hw <= right &&
             n.y + hh >= top  && n.y - hh <= bottom;
    });
  }, [nodes, vp]);

  // ── Dim / search ──────────────────────────────────────────────────────────
  const lowerSearch = search.toLowerCase();

  // Check whether a taxonomy path (e.g. "technology/ai") matches any sidebar selection.
  // A node matches if any selected path is equal to or a prefix of it.
  const pathMatchesSidebar = useCallback(
    (path: string): boolean => {
      if (selectedPaths.size === 0) return true;
      const lower = path.toLowerCase();
      for (const p of selectedPaths) {
        if (lower === p || lower.startsWith(p + "/")) return true;
      }
      return false;
    },
    [selectedPaths],
  );

  const getDimAmount = useCallback(
    (nodeType: string, catName?: string, topicTitle?: string, taxonomyPath?: string): number => {
      const isCat = nodeType === "category";

      // Sidebar multi-select filter (takes priority when active)
      if (selectedPaths.size > 0) {
        if (isCat) {
          const slug = (catName ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          if (!pathMatchesSidebar(slug)) return 0.7;
        }
        if (nodeType === "topic") {
          const path = taxonomyPath ?? (catName ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          if (!pathMatchesSidebar(path)) return 0.85;
        }
      }

      // Category tile click filter (single-select)
      if (activeCategory) {
        if (isCat)  return catName === activeCategory ? 0 : 0.7;
        if (nodeType === "topic" && catName !== activeCategory) return 0.85;
      }

      // Text search filter
      if (nodeType === "topic" && lowerSearch) {
        if (!topicTitle?.toLowerCase().includes(lowerSearch)) return 0.82;
      }
      return 0;
    },
    [activeCategory, lowerSearch, selectedPaths, pathMatchesSidebar],
  );

  // ── Skeleton / loading ────────────────────────────────────────────────────
  if (!ready && topics.size === 0) {
    return (
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "var(--background)" }}>
        <LandingHUD
          search={search} onSearchChange={setSearch}
          sortKey={sortKey} onSortChange={setSortKey}
          activeCategory={activeCategory} onClearCategory={() => setActiveCategory(null)}
          globalStats={{ topicCount: 0, videoCount: 0, viewCount: 0 }}
          onHome={handleHome} zoom={vp.zoom} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 40, paddingTop: 140 }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              style={{
                width:  i % 6 === 0 ? CATEGORY_TILE_SIZE : TOPIC_TILE_SIZE,
                height: i % 6 === 0 ? CATEGORY_TILE_SIZE : TOPIC_TILE_SIZE,
                borderRadius: 10,
                background:   "rgba(255,255,255,0.04)",
                animation:    "pulse 1.4s ease-in-out infinite",
                animationDelay: `${(i * 0.06).toFixed(2)}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Canvas ────────────────────────────────────────────────────────────────
  const canvasTransform = `translate(${vp.x}px,${vp.y}px) scale(${vp.zoom})`;

  // Lane separator X positions (between sections, in canvas-space)
  const laneSeparatorXs = Array.from(
    { length: SECTIONS_PER_ROW - 1 },
    (_, i) => (i + 1) * SECTION_PITCH - 32,
  );

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position:    "fixed",
        inset:       0,
        overflow:    "hidden",
        cursor:      isDraggingState ? "grabbing" : "default",
        touchAction: "none",
        background:  "var(--background)",
      }}
    >
      {/* ── Background dot grid (parallax with canvas) ── */}
      <div
        style={{
          position:        "absolute",
          inset:           0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize:  `${Math.max(16, 36 * vp.zoom)}px ${Math.max(16, 36 * vp.zoom)}px`,
          backgroundPosition: `${vp.x % (36 * vp.zoom)}px ${vp.y % (36 * vp.zoom)}px`,
          pointerEvents:   "none",
        }}
      />

      {/* ── Transform container ─────────────────────────────────────────── */}
      <div
        style={{
          position:        "absolute",
          top:             0,
          left:            0,
          transformOrigin: "0 0",
          transform:       canvasTransform,
          willChange:      "transform",
        }}
      >
        {/* Lane separator trace lines (vertical, between sections) */}
        {laneSeparatorXs.map((lx) => (
          <div
            key={lx}
            style={{
              position:      "absolute",
              left:          lx,
              top:           bounds.minY - 60,
              width:         2,
              height:        bounds.height + 120,
              background:    "linear-gradient(to bottom, transparent 0%, rgba(0,255,180,0.07) 8%, rgba(0,255,180,0.07) 92%, transparent 100%)",
              pointerEvents: "none",
            }}
          />
        ))}

        {/* Tiles */}
        {visibleNodes.map((node) => {
          const tileLeft = node.x - node.w / 2;
          const tileTop  = node.y - node.h / 2;

          // ── Category tile ──────────────────────────────────────────────
          if (node.type === "category") {
            const isActive   = activeCategory === node.categoryName;
            const isFiltered = activeCategory !== null && !isActive;
            const catName    = node.categoryName!;

            return (
              <div key={node.id} style={{ position: "absolute", left: tileLeft, top: tileTop }}>
                <CategoryTile
                  name={catName}
                  topicCount={node.topicCount!}
                  totalVideos={node.totalVideos!}
                  totalViews={node.totalViews!}
                  totalNetLikes={node.totalNetLikes!}
                  isActive={isActive}
                  isFiltered={isFiltered}
                  zoom={vp.zoom}
                  onClick={() => handleCategoryClick(catName)}
                />
                {/* PCB trace connector — category tile to first topic row */}
                <div
                  style={{
                    position:      "absolute",
                    left:          CATEGORY_TILE_SIZE / 2 - 1,
                    top:           CATEGORY_TILE_SIZE,
                    width:         2,
                    height:        28,
                    background:    isActive
                      ? "rgba(0,255,180,0.55)"
                      : "linear-gradient(to bottom, rgba(0,255,180,0.30) 0%, rgba(0,255,180,0.08) 100%)",
                    borderRadius:  1,
                    transition:    "background 0.25s ease",
                    pointerEvents: "none",
                  }}
                />
                {vp.zoom >= 0.35 && (
                  <div
                    style={{
                      position:      "absolute",
                      left:          CATEGORY_TILE_SIZE + 6,
                      top:           4,
                      fontSize:      9,
                      fontWeight:    700,
                      color:         "rgba(0,255,180,0.25)",
                      fontFamily:    "monospace",
                      letterSpacing: "0.08em",
                      userSelect:    "none",
                      pointerEvents: "none",
                    }}
                  >
                    {catName.toUpperCase().slice(0, 3)}
                  </div>
                )}
              </div>
            );
          }

          // ── Separator node ─────────────────────────────────────────────
          if (node.type === "separator") {
            if (vp.zoom < 0.4) return null;
            return (
              <div
                key={node.id}
                style={{
                  position:      "absolute",
                  left:          tileLeft,
                  top:           tileTop,
                  width:         node.w,
                  height:        node.h,
                  display:       "flex",
                  alignItems:    "center",
                  gap:           8,
                  pointerEvents: "none",
                  userSelect:    "none",
                }}
              >
                <div
                  style={{
                    width:        3,
                    height:       "60%",
                    borderRadius: 2,
                    background:   "rgba(0,255,180,0.35)",
                    flexShrink:   0,
                  }}
                />
                <span
                  style={{
                    fontSize:      10,
                    fontWeight:    600,
                    color:         "rgba(0,255,180,0.50)",
                    fontFamily:    "monospace",
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    whiteSpace:    "nowrap",
                    overflow:      "hidden",
                    textOverflow:  "ellipsis",
                    maxWidth:      node.w - 40,
                  }}
                >
                  {node.separatorLabel}
                </span>
                <div
                  style={{
                    flex:       1,
                    height:     1,
                    background: "rgba(0,255,180,0.10)",
                  }}
                />
              </div>
            );
          }

          // ── Ad tile ────────────────────────────────────────────────────
          if (node.type === "ad") {
            return (
              <div
                key={node.id}
                style={{ position: "absolute", left: tileLeft, top: tileTop }}
              >
                <AdTile
                  width={node.w}
                  height={node.h}
                  adSlotIndex={node.adSlotIndex!}
                  categoryName={node.adCategoryName}
                  adImageUrl={null}
                  adLinkUrl={null}
                  zoom={vp.zoom}
                />
              </div>
            );
          }

          // ── Topic tile ─────────────────────────────────────────────────
          const topic   = node.topic!;
          const catName = topic.taxonomyPath
            ? topic.taxonomyPath.split("/")[0]
            : topic.category || "General";
          const dimAmount = getDimAmount("topic", catName, topic.title, topic.taxonomyPath);

          return (
            <div key={node.id} style={{ position: "absolute", left: tileLeft, top: tileTop }}>
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

      {/* ── HUD ── */}
      <LandingHUD
        search={search}
        onSearchChange={setSearch}
        sortKey={sortKey}
        onSortChange={setSortKey}
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
