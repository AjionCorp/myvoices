import { create } from "zustand";

interface ExploreStore {
  sidebarOpen: boolean;
  /** Set of taxonomy node `path` values that are checked, e.g. "technology" or "technology/artificial-intelligence" */
  selectedPaths: Set<string>;
  toggleSidebar(): void;
  setSidebarOpen(v: boolean): void;
  /** Toggle a single path on/off. */
  togglePath(path: string): void;
  /** Replace the whole selection (used for parent→children bulk operations). */
  setPaths(paths: Set<string>): void;
  clearPaths(): void;
}

export const useExploreStore = create<ExploreStore>((set) => ({
  sidebarOpen: false,
  selectedPaths: new Set(),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  togglePath: (path) =>
    set((s) => {
      const next = new Set(s.selectedPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { selectedPaths: next };
    }),

  setPaths: (paths) => set({ selectedPaths: new Set(paths) }),

  clearPaths: () => set({ selectedPaths: new Set() }),
}));
