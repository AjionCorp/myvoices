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
import { CENTER_X, CENTER_Y } from "@/lib/constants";
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
  const loading = useBlocksStore((s) => s.loading);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      // Clean up URL param from legacy auth callback; OIDC handles auth now
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    const blockParam = new URLSearchParams(window.location.search).get("block");
    if (blockParam) {
      const blockId = parseInt(blockParam, 10);
      const target = useBlocksStore.getState().blocks.get(blockId);
      if (target) {
        centerOnBlock(target.x, target.y);
        selectBlock(blockId);
      }
    }
  }, [loading, centerOnBlock, selectBlock]);

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
