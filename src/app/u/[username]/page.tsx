"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Header } from "@/components/ui/Header";
import { BlockDetailPanel } from "@/components/canvas/BlockDetailPanel";
import { Minimap } from "@/components/canvas/Minimap";
import { CanvasViewport } from "@/components/canvas/CanvasViewport";
import { useCanvasStore } from "@/stores/canvas-store";
import { useBlocksStore } from "@/stores/blocks-store";
import { useTopicStore } from "@/stores/topic-store";
import { useCommentsStore } from "@/stores/comments-store";
import { useFollowsStore } from "@/stores/follows-store";
import { useUserBlocksSubscription } from "@/components/spacetimedb/SpacetimeDBProvider";
import { getConnection } from "@/lib/spacetimedb/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { UserCard } from "@/components/profile/UserCard";
import { ProfileSidebar } from "@/components/profile/ProfileSidebar";

const VideoCanvas = dynamic(
  () =>
    import("@/components/canvas/VideoCanvas").then((mod) => ({
      default: mod.VideoCanvas,
    })),
  { ssr: false }
);

export interface ProfileUser {
  identity: string;
  username: string;
  displayName: string;
  bio: string | null;
  location: string | null;
  websiteUrl: string | null;
  socialX: string | null;
  socialYoutube: string | null;
  socialTiktok: string | null;
  socialInstagram: string | null;
  createdAt: number;
  isAdmin: boolean;
}

export default function UserProfilePage() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [filterTopicId, setFilterTopicId] = useState<number | null>(null);

  const { centerOn, screenWidth } = useCanvasStore();
  const loading = useBlocksStore((s) => s.loading);
  const topics = useTopicStore((s) => s.topics);
  const currentUser = useAuthStore((s) => s.user);
  const isOwnProfile = currentUser?.identity === profileUser?.identity;

  // Resolve user profile from username by searching user_profile table
  useEffect(() => {
    const conn = getConnection();
    if (!conn) {
      // Wait for connection — try again shortly
      const timer = setTimeout(() => {
        const c = getConnection();
        if (!c) return;
        findUser(c);
      }, 1000);
      return () => clearTimeout(timer);
    }
    findUser(conn);

    function findUser(c: ReturnType<typeof getConnection>) {
      if (!c) return;
      let found: ProfileUser | null = null;
      for (const row of c.db.user_profile.iter()) {
        if (row.username === username) {
          found = {
            identity: row.identity,
            username: row.username,
            displayName: row.displayName,
            bio: row.bio ?? null,
            location: row.location ?? null,
            websiteUrl: row.websiteUrl ?? null,
            socialX: row.socialX ?? null,
            socialYoutube: row.socialYoutube ?? null,
            socialTiktok: row.socialTiktok ?? null,
            socialInstagram: row.socialInstagram ?? null,
            createdAt: Number(row.createdAt),
            isAdmin: row.isAdmin,
          };
          break;
        }
      }
      if (found) {
        setProfileUser(found);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    }
  }, [username]);

  // Subscribe to this user's blocks
  useUserBlocksSubscription(profileUser?.identity ?? null);

  // Center viewport when entering profile page
  useEffect(() => {
    if (screenWidth > 0) {
      centerOn(0, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenWidth, profileUser?.identity]);

  // Compute user stats from subscribed data
  const blocks = useBlocksStore((s) => s.blocks);
  const comments = useCommentsStore((s) => s.comments);

  const stats = useMemo(() => {
    if (!profileUser) return { videoCount: 0, topicCount: 0, commentCount: 0, karma: 0, topicIds: new Set<number>() };

    let videoCount = 0;
    let karma = 0;
    const topicIds = new Set<number>();
    for (const b of blocks.values()) {
      if (b.ownerIdentity === profileUser.identity) {
        videoCount++;
        topicIds.add(b.topicId);
        karma += b.likes - b.dislikes;
      }
    }

    let topicsCreated = 0;
    for (const t of topics.values()) {
      if (t.creatorIdentity === profileUser.identity) topicsCreated++;
    }

    let commentCount = 0;
    for (const c of comments.values()) {
      if (c.userIdentity === profileUser.identity) {
        commentCount++;
        karma += c.likesCount;
      }
    }

    return { videoCount, topicCount: topicsCreated, commentCount, karma, topicIds };
  }, [profileUser, blocks, topics, comments]);

  const followerCount = useFollowsStore((s) =>
    profileUser ? s.getFollowerCount(profileUser.identity) : 0
  );
  const followingCount = useFollowsStore((s) =>
    profileUser ? s.getFollowingCount(profileUser.identity) : 0
  );

  if (notFound && topics.size > 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Header />
        <h1 className="mt-8 text-xl font-semibold text-foreground">User not found</h1>
        <p className="mt-2 text-sm text-muted">
          The user <code className="text-accent">@{username}</code> does not exist.
        </p>
        <Link href="/" className="mt-6 text-sm text-accent hover:underline">
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <VideoCanvas />

      <ProfileSidebar
        open={sidebarOpen}
        profileUser={profileUser}
        stats={stats}
        filterTopicId={filterTopicId}
        onFilterTopicId={setFilterTopicId}
      />

      <div className="pointer-events-none absolute inset-0 z-30">
        {/* Top bar */}
        <div className="pointer-events-auto flex items-center gap-2 px-4 pt-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((o) => !o)}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
            style={{
              background: "rgba(14,14,14,0.85)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
            }}
          >
            <Menu size={16} />
          </Button>

          {profileUser && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white/80"
              style={{
                background: "rgba(14,14,14,0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
              }}
            >
              <span className="text-white">{profileUser.displayName}</span>
              <span className="text-white/40">@{profileUser.username}</span>
            </div>
          )}
        </div>

        {/* User card overlay at center of canvas */}
        {profileUser && (
          <UserCard
            profileUser={profileUser}
            isOwnProfile={isOwnProfile}
            stats={{ ...stats, followerCount, followingCount }}
          />
        )}

        <BlockDetailPanel />
        <Minimap />
        <CanvasViewport />
      </div>
    </div>
  );
}
