"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { Header } from "@/components/ui/Header";
import { StatsBar } from "@/components/ui/StatsBar";
import { WinnersHero } from "@/components/ui/WinnersHero";
import { CanvasViewport } from "@/components/canvas/CanvasViewport";
import { BlockDetailPanel } from "@/components/canvas/BlockDetailPanel";
import { SubmissionModal } from "@/components/canvas/SubmissionModal";
import { useCanvasStore } from "@/stores/canvas-store";
import { useBlocksStore } from "@/stores/blocks-store";
import { useContestStore } from "@/stores/contest-store";
import { useAuthStore } from "@/stores/auth-store";
import { CENTER_X, CENTER_Y, BlockStatus } from "@/lib/constants";
import { generateMockBlocks } from "@/lib/mock-data";
import { startViewerSimulation } from "@/stores/viewers-store";
import { Minimap } from "@/components/canvas/Minimap";
import { ViewerCursors } from "@/components/canvas/ViewerCursors";

const VideoCanvas = dynamic(
  () =>
    import("@/components/canvas/VideoCanvas").then((mod) => ({
      default: mod.VideoCanvas,
    })),
  { ssr: false }
);

export default function Home() {
  const { centerOnBlock, selectBlock, screenWidth } = useCanvasStore();
  const { setBlocks, setStats, setTopBlocks } = useBlocksStore();
  const { setWinners } = useContestStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      useAuthStore.getState().setToken(token);
      localStorage.setItem("spacetimedb_token", token);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const { setLoading } = useBlocksStore.getState();
    setLoading(true);

    // Defer heavy generation so the first paint + event listeners are set up first
    requestAnimationFrame(() => {
      if (cancelled) return;
      const mockBlocks = generateMockBlocks();
      if (cancelled) return;
      setBlocks(mockBlocks);

      const claimed = mockBlocks.filter((b) => b.status === BlockStatus.Claimed);
      const totalLikes = claimed.reduce((sum, b) => sum + b.likes, 0);
      setStats(claimed.length, totalLikes);

      const top = [...claimed].sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes)).slice(0, 10);
      setTopBlocks(top);
      setLoading(false);

      const blockParam = new URLSearchParams(window.location.search).get("block");
      if (blockParam) {
        const blockId = parseInt(blockParam, 10);
        const target = useBlocksStore.getState().blocks.get(blockId);
        if (target) {
          centerOnBlock(target.x, target.y);
          selectBlock(blockId);
        }
      }
    });

    return () => { cancelled = true; };
  }, [setBlocks, setStats, setTopBlocks, centerOnBlock, selectBlock]);

  useEffect(() => {
    if (screenWidth > 0) {
      const hasDeepLink = new URLSearchParams(window.location.search).has("block");
      if (!hasDeepLink) {
        centerOnBlock(CENTER_X, CENTER_Y);
      }
    }
  }, [screenWidth, centerOnBlock]);

  useEffect(() => {
    const stop = startViewerSimulation();
    return stop;
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <VideoCanvas />
      <ViewerCursors />

      <div className="pointer-events-none absolute inset-0 z-30">
        <Header />
        <WinnersHero />
        <BlockDetailPanel />
        <SubmissionModal />
        <Minimap />
        <CanvasViewport />
        <StatsBar />
      </div>
    </div>
  );
}
