import { create } from "zustand";
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM, CENTER_X, CENTER_Y, TILE_WIDTH, TILE_HEIGHT } from "@/lib/constants";

interface CanvasState {
  viewportX: number;
  viewportY: number;
  zoom: number;
  screenWidth: number;
  screenHeight: number;
  isDragging: boolean;
  selectedBlockId: number | null;
  showSubmissionModal: boolean;
  submissionBlockId: number | null;

  setViewport: (x: number, y: number) => void;
  panBy: (dx: number, dy: number) => void;
  setZoom: (zoom: number, pivotX?: number, pivotY?: number) => void;
  zoomBy: (delta: number, pivotX: number, pivotY: number) => void;
  setScreenSize: (width: number, height: number) => void;
  setDragging: (dragging: boolean) => void;
  selectBlock: (blockId: number | null) => void;
  openSubmissionModal: (blockId: number) => void;
  closeSubmissionModal: () => void;
  centerOnBlock: (gridX: number, gridY: number) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  viewportX: -(CENTER_X * TILE_WIDTH + TILE_WIDTH / 2) * DEFAULT_ZOOM + 500,
  viewportY: -(CENTER_Y * TILE_HEIGHT + TILE_HEIGHT / 2) * DEFAULT_ZOOM + 400,
  zoom: DEFAULT_ZOOM,
  screenWidth: 0,
  screenHeight: 0,
  isDragging: false,
  selectedBlockId: null,
  showSubmissionModal: false,
  submissionBlockId: null,

  setViewport: (x, y) => set({ viewportX: x, viewportY: y }),

  panBy: (dx, dy) =>
    set((s) => ({
      viewportX: s.viewportX + dx,
      viewportY: s.viewportY + dy,
    })),

  setZoom: (zoom, pivotX, pivotY) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    if (pivotX !== undefined && pivotY !== undefined) {
      const state = get();
      const worldX = (pivotX - state.viewportX) / state.zoom;
      const worldY = (pivotY - state.viewportY) / state.zoom;
      set({
        zoom: clamped,
        viewportX: pivotX - worldX * clamped,
        viewportY: pivotY - worldY * clamped,
      });
    } else {
      set({ zoom: clamped });
    }
  },

  zoomBy: (delta, pivotX, pivotY) => {
    const state = get();
    const factor = 1 + delta;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom * factor));
    const worldX = (pivotX - state.viewportX) / state.zoom;
    const worldY = (pivotY - state.viewportY) / state.zoom;
    set({
      zoom: newZoom,
      viewportX: pivotX - worldX * newZoom,
      viewportY: pivotY - worldY * newZoom,
    });
  },

  setScreenSize: (width, height) => set({ screenWidth: width, screenHeight: height }),

  setDragging: (dragging) => set({ isDragging: dragging }),

  selectBlock: (blockId) => {
    set({ selectedBlockId: blockId });
    if (typeof window !== "undefined") {
      if (blockId !== null) {
        window.history.replaceState({}, "", `/?block=${blockId}`);
      } else {
        window.history.replaceState({}, "", "/");
      }
    }
  },

  openSubmissionModal: (blockId) =>
    set({ showSubmissionModal: true, submissionBlockId: blockId }),

  closeSubmissionModal: () =>
    set({ showSubmissionModal: false, submissionBlockId: null }),

  centerOnBlock: (gridX, gridY) => {
    const state = get();
    const worldX = gridX * TILE_WIDTH + TILE_WIDTH / 2;
    const worldY = gridY * TILE_HEIGHT + TILE_HEIGHT / 2;
    set({
      viewportX: state.screenWidth / 2 - worldX * state.zoom,
      viewportY: state.screenHeight / 2 - worldY * state.zoom,
    });
  },
}));
