"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Video, MessageSquareText, Layers, Shield } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBlocksStore } from "@/stores/blocks-store";
import { useTopicStore } from "@/stores/topic-store";
import { useCommentsStore } from "@/stores/comments-store";
import { useCanvasStore } from "@/stores/canvas-store";
import { cn } from "@/lib/utils";
import type { ProfileUser } from "@/app/u/[username]/page";

interface ProfileSidebarProps {
  open: boolean;
  profileUser: ProfileUser | null;
  stats: {
    videoCount: number;
    topicCount: number;
    commentCount: number;
    topicIds: Set<number>;
  };
  filterTopicId: number | null;
  onFilterTopicId: (id: number | null) => void;
}

export function ProfileSidebar({
  open,
  profileUser,
  stats,
  filterTopicId,
  onFilterTopicId,
}: ProfileSidebarProps) {
  const [activeTab, setActiveTab] = useState<"videos" | "topics" | "comments" | "moderating">("videos");

  const topics = useTopicStore((s) => s.topics);
  const moderators = useTopicStore((s) => s.moderators);
  const blocks = useBlocksStore((s) => s.blocks);
  const comments = useCommentsStore((s) => s.comments);
  const centerOn = useCanvasStore((s) => s.centerOn);

  // Topics where user has videos, with video count per topic
  const videoTopics = useMemo(() => {
    if (!profileUser) return [];
    const countMap = new Map<number, number>();
    for (const b of blocks.values()) {
      if (b.ownerIdentity === profileUser.identity) {
        countMap.set(b.topicId, (countMap.get(b.topicId) ?? 0) + 1);
      }
    }
    return [...countMap.entries()]
      .map(([topicId, count]) => {
        const topic = topics.get(topicId);
        return topic ? { topic, count } : null;
      })
      .filter(Boolean) as { topic: { id: number; slug: string; title: string }; count: number }[];
  }, [profileUser, blocks, topics]);

  // Topics created by user
  const createdTopics = useMemo(() => {
    if (!profileUser) return [];
    return [...topics.values()].filter((t) => t.creatorIdentity === profileUser.identity);
  }, [profileUser, topics]);

  // Recent comments by user
  const userComments = useMemo(() => {
    if (!profileUser) return [];
    return [...comments.values()]
      .filter((c) => c.userIdentity === profileUser.identity)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  }, [profileUser, comments]);

  // Topics user moderates
  const moderatingTopics = useMemo(() => {
    if (!profileUser) return [];
    const modTopicIds = [...moderators.values()]
      .filter((m) => m.identity === profileUser.identity && m.status === "active")
      .map((m) => m.topicId);
    return modTopicIds
      .map((id) => topics.get(id))
      .filter(Boolean) as { id: number; slug: string; title: string }[];
  }, [profileUser, moderators, topics]);

  const handleTopicFilter = (topicId: number) => {
    if (filterTopicId === topicId) {
      onFilterTopicId(null);
    } else {
      onFilterTopicId(topicId);
      // Center on the first block of this topic
      for (const b of blocks.values()) {
        if (b.ownerIdentity === profileUser?.identity && b.topicId === topicId) {
          centerOn(b.x, b.y);
          break;
        }
      }
    }
  };

  const tabs = [
    { key: "videos" as const, icon: Video, label: "Videos", count: stats.videoCount },
    { key: "topics" as const, icon: Layers, label: "Topics", count: stats.topicCount },
    { key: "comments" as const, icon: MessageSquareText, label: "Comments", count: stats.commentCount },
    { key: "moderating" as const, icon: Shield, label: "Moderating", count: moderatingTopics.length },
  ];

  return (
    <div
      className={cn(
        "absolute left-0 top-0 z-20 flex h-full flex-col transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full"
      )}
      style={{
        width: 280,
        background: "rgba(10,10,10,0.92)",
        backdropFilter: "blur(16px)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <span className="text-sm font-semibold text-white/80">
          {profileUser?.displayName ?? "Profile"}
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-3 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
              activeTab === tab.key
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/60 hover:bg-white/5"
            )}
          >
            <tab.icon size={12} />
            {tab.count > 0 && <span>{tab.count}</span>}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 px-3 pb-4">
        {activeTab === "videos" && (
          <div className="space-y-1">
            {videoTopics.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-white/30">No videos yet</p>
            ) : (
              videoTopics.map(({ topic, count }) => (
                <button
                  key={topic.id}
                  onClick={() => handleTopicFilter(topic.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors",
                    filterTopicId === topic.id
                      ? "bg-accent/15 text-accent"
                      : "text-white/60 hover:bg-white/5 hover:text-white/80"
                  )}
                >
                  <span className="truncate">{topic.title}</span>
                  <span className="ml-2 shrink-0 tabular-nums text-white/30">{count}</span>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === "topics" && (
          <div className="space-y-1">
            {createdTopics.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-white/30">No topics created</p>
            ) : (
              createdTopics.map((t) => (
                <Link
                  key={t.id}
                  href={`/t/${t.slug}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white/80 transition-colors"
                >
                  <Layers size={12} className="shrink-0 text-white/30" />
                  <span className="truncate">{t.title}</span>
                </Link>
              ))
            )}
          </div>
        )}

        {activeTab === "comments" && (
          <div className="space-y-1">
            {userComments.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-white/30">No comments yet</p>
            ) : (
              userComments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg px-3 py-2 text-xs text-white/50 hover:bg-white/5 transition-colors"
                >
                  <p className="line-clamp-2 text-white/60">{c.text}</p>
                  <p className="mt-1 text-[10px] text-white/25">
                    {new Date(c.createdAt / 1000).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "moderating" && (
          <div className="space-y-1">
            {moderatingTopics.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-white/30">Not moderating any topics</p>
            ) : (
              moderatingTopics.map((t) => (
                <Link
                  key={t.id}
                  href={`/t/${t.slug}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white/80 transition-colors"
                >
                  <Shield size={12} className="shrink-0 text-accent/60" />
                  <span className="truncate">{t.title}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
