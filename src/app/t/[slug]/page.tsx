"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Header } from "@/components/ui/Header";
import { LoginButton } from "@/components/auth/LoginButton";
import { BlockDetailPanel } from "@/components/canvas/BlockDetailPanel";
import { SubmissionModal } from "@/components/canvas/SubmissionModal";
import { AddVideoModal } from "@/components/canvas/AddVideoModal";
import { ExploreLoginModal } from "@/components/canvas/ExploreLoginModal";
import { Minimap } from "@/components/canvas/Minimap";
import { ViewerCursors } from "@/components/canvas/ViewerCursors";
import { CanvasViewport } from "@/components/canvas/CanvasViewport";
import { useCanvasStore } from "@/stores/canvas-store";
import { useBlocksStore } from "@/stores/blocks-store";
import { useTopicStore } from "@/stores/topic-store";
import { useTopicBlocksSubscription } from "@/components/spacetimedb/SpacetimeDBProvider";
import { getConnection } from "@/lib/spacetimedb/client";
import { startViewerSimulation } from "@/stores/viewers-store";
import { AnonymousViewportFetcher } from "@/lib/spacetimedb/AnonymousViewportFetcher";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const VideoCanvas = dynamic(
  () =>
    import("@/components/canvas/VideoCanvas").then((mod) => ({
      default: mod.VideoCanvas,
    })),
  { ssr: false }
);

function TopicHeader({ slug }: { slug: string }) {
  const topics = useTopicStore((s) => s.topics);
  const activeTopic = useTopicStore((s) => s.activeTopic);
  const topic = activeTopic || [...topics.values()].find((t) => t.slug === slug);
  const { totalClaimed } = useBlocksStore();

  return (
    <div className="pointer-events-auto absolute top-0 left-0 right-0 z-30">
      <div className="flex items-center bg-background/80 px-4 py-2 backdrop-blur-sm border-b border-border/50">
        {/* left: breadcrumb + title + meta + action */}
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <Link href="/" className="text-muted hover:text-foreground transition-colors text-sm shrink-0">
            ← Topics
          </Link>
          <span className="text-border shrink-0">/</span>
          {topic ? (
            <>
              <h1 className="text-sm font-semibold text-foreground truncate">
                {topic.title}
              </h1>
              <span className="flex items-center gap-3 text-xs text-muted shrink-0">
                <Badge variant="outline" className="rounded-md bg-surface text-xs">
                  {topic.category}
                </Badge>
                <span>{totalClaimed.toLocaleString()} / ∞ videos</span>
                <Button
                  onClick={() => useCanvasStore.getState().openSubmissionModal()}
                  size="sm"
                  className="pointer-events-auto h-7 rounded-lg px-3 text-xs font-semibold"
                >
                  + Add Video
                </Button>
              </span>
            </>
          ) : (
            <span className="text-sm text-muted">Loading…</span>
          )}
        </div>

        {/* right: user avatar — always far right */}
        <div className="pointer-events-auto shrink-0 pl-4">
          <LoginButton />
        </div>
      </div>
    </div>
  );
}

export default function TopicPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const { centerOn, screenWidth } = useCanvasStore();
  const loading = useBlocksStore((s) => s.loading);
  const { topics, setActiveTopic, getTopicBySlug } = useTopicStore();
  const { isLoading: authLoading, isAuthenticated } = useAuthStore();

  // Resolve topic from slug
  const topic = getTopicBySlug(slug);
  const topicId = topic?.id ?? null;

  // Set/clear the active topic when entering/leaving this page
  useEffect(() => {
    if (topic) {
      setActiveTopic(topic);
      // Increment view counter
      const conn = getConnection();
      if (conn) {
        conn.reducers.incrementTopicViews({ topicId: BigInt(topic.id) });
      }
    }
    return () => {
      setActiveTopic(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id]);

  // Subscribe to this topic's blocks
  useTopicBlocksSubscription(topicId);

  // Center viewport at (0,0) whenever the topic changes or screen dimensions become known
  useEffect(() => {
    if (screenWidth > 0) {
      centerOn(0, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenWidth, slug]);

  // Viewer cursor simulation
  useEffect(() => {
    const stop = startViewerSimulation();
    return stop;
  }, []);

  // Deep-link: center on a block
  useEffect(() => {
    if (loading) return;
    const blockParam = new URLSearchParams(window.location.search).get("block");
    if (blockParam) {
      const blockId = parseInt(blockParam, 10);
      const target = useBlocksStore.getState().blocks.get(blockId);
      if (target) {
        centerOn(target.x, target.y);
        useCanvasStore.getState().selectBlock(blockId);
      }
    }
  }, [loading, centerOn]);

  if (!topic && topics.size > 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Header />
        <h1 className="mt-8 text-xl font-semibold text-foreground">Topic not found</h1>
        <p className="mt-2 text-sm text-muted">
          The topic <code className="text-accent">{slug}</code> does not exist.
        </p>
        <Link href="/" className="mt-6 text-sm text-accent hover:underline">
          ← Back to all topics
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <VideoCanvas />
      <ViewerCursors />
      {!authLoading && !isAuthenticated && topicId !== null && (
        <AnonymousViewportFetcher topicId={topicId} />
      )}

      <div className="pointer-events-none absolute inset-0 z-30">
        <TopicHeader slug={slug} />
        <BlockDetailPanel />
        <SubmissionModal />
        <AddVideoModal />
        <Minimap />
        <CanvasViewport />
      </div>
      <ExploreLoginModal />
    </div>
  );
}
