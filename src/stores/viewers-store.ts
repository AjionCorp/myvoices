import { create } from "zustand";
import { GRID_COLS, GRID_ROWS, TILE_WIDTH, TILE_HEIGHT } from "@/lib/constants";

export interface Viewer {
  id: string;
  name: string;
  color: string;
  /** World-pixel X of the center of their viewport */
  worldX: number;
  /** World-pixel Y of the center of their viewport */
  worldY: number;
}

interface ViewersState {
  viewers: Viewer[];
  setViewers: (v: Viewer[]) => void;
  updateViewer: (id: string, worldX: number, worldY: number) => void;
}

export const useViewersStore = create<ViewersState>((set) => ({
  viewers: [],
  setViewers: (viewers) => set({ viewers }),
  updateViewer: (id, worldX, worldY) =>
    set((s) => ({
      viewers: s.viewers.map((v) =>
        v.id === id ? { ...v, worldX, worldY } : v
      ),
    })),
}));

const VIEWER_COLORS = [
  "#f97316", "#06b6d4", "#a855f7", "#ec4899", "#22c55e",
  "#eab308", "#ef4444", "#3b82f6", "#14b8a6", "#f59e0b",
  "#8b5cf6", "#10b981", "#e879f9", "#38bdf8", "#fb923c",
];

const NAMES = [
  "Alex", "Mira", "Jordan", "Taylor", "Casey", "Riley", "Morgan",
  "Quinn", "Sage", "Avery", "Dakota", "Luna", "Nova", "Kai", "Wren",
  "Phoenix", "River", "Harper", "Blake", "Drew", "Finley", "Kit",
  "Jude", "Nico", "Scout", "Cruz", "Lux", "Ash", "Beau", "Zara",
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIMULATED_COUNT = 25;
const CENTER_WX = Math.floor(GRID_COLS / 2) * TILE_WIDTH;
const CENTER_WY = Math.floor(GRID_ROWS / 2) * TILE_HEIGHT;
const SPREAD = 150 * TILE_WIDTH;

/**
 * Starts a mock simulation of other viewers moving around the map.
 * Returns a cleanup function that stops the interval.
 */
export function startViewerSimulation(): () => void {
  const rng = mulberry32(99);

  const initial: Viewer[] = Array.from({ length: SIMULATED_COUNT }, (_, i) => {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * SPREAD;
    return {
      id: `viewer_${i}`,
      name: NAMES[i % NAMES.length],
      color: VIEWER_COLORS[i % VIEWER_COLORS.length],
      worldX: CENTER_WX + Math.cos(angle) * dist,
      worldY: CENTER_WY + Math.sin(angle) * dist,
    };
  });

  useViewersStore.getState().setViewers(initial);

  const drift = () => {
    const store = useViewersStore.getState();
    const next = store.viewers.map((v) => {
      const dx = (Math.random() - 0.5) * TILE_WIDTH * 30;
      const dy = (Math.random() - 0.5) * TILE_HEIGHT * 30;
      return {
        ...v,
        worldX: Math.max(0, Math.min(GRID_COLS * TILE_WIDTH, v.worldX + dx)),
        worldY: Math.max(0, Math.min(GRID_ROWS * TILE_HEIGHT, v.worldY + dy)),
      };
    });
    store.setViewers(next);
  };

  const id = setInterval(drift, 3000);
  return () => clearInterval(id);
}
