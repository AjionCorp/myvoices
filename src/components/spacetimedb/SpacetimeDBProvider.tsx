"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { connect, disconnect, reconnect, getConnection, subscribeToNotifications, type ConnectionCallbacks } from "@/lib/spacetimedb/client";
import { useBlocksStore, type Block as StoreBlock } from "@/stores/blocks-store";
import {
  useTopicStore,
  type Topic,
  type TopicModerator,
  type TopicModeratorApplication,
  type TopicTaxonomyNode,
} from "@/stores/topic-store";
import { useContestStore } from "@/stores/contest-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCommentsStore } from "@/stores/comments-store";
import { useNotificationsStore } from "@/stores/notifications-store";
import { BlockStatus, Platform } from "@/lib/constants";
import { batchSpiralCoordinates } from "@/lib/canvas/spiral-layout";
import { useAuth } from "@/components/auth/AuthProvider";
import type { DbConnection } from "@/module_bindings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBlock(row: any): StoreBlock {
  return {
    id: Number(row.id),
    topicId: Number(row.topicId),
    x: row.x,
    y: row.y,
    videoId: row.videoId || null,
    platform: (row.platform || null) as Platform | null,
    ownerIdentity: row.ownerIdentity || null,
    ownerName: row.ownerName || null,
    likes: Number(row.likes ?? 0),
    dislikes: Number(row.dislikes ?? 0),
    ytViews: Number(row.ytViews ?? 0),
    ytLikes: Number(row.ytLikes ?? 0),
    thumbnailUrl: row.thumbnailUrl || null,
    status: (row.status as BlockStatus) || BlockStatus.Empty,
    adImageUrl: row.adImageUrl || null,
    adLinkUrl: row.adLinkUrl || null,
    claimedAt: row.claimedAt ? Number(row.claimedAt) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTopic(row: any): Topic {
  return {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    taxonomyNodeId: row.taxonomyNodeId ? Number(row.taxonomyNodeId) : null,
    creatorIdentity: row.creatorIdentity,
    videoCount: Number(row.videoCount ?? 0),
    totalLikes: Number(row.totalLikes ?? 0),
    totalDislikes: Number(row.totalDislikes ?? 0),
    totalViews: Number(row.totalViews ?? 0),
    isActive: row.isActive,
    createdAt: Number(row.createdAt ?? 0),
    moderatorCount: undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTaxonomyNode(row: any): TopicTaxonomyNode {
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    parentId: row.parentId ? Number(row.parentId) : null,
    path: row.path,
    depth: Number(row.depth ?? 0),
    isActive: row.isActive,
    createdAt: Number(row.createdAt ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTopicModerator(row: any): TopicModerator {
  return {
    id: Number(row.id),
    topicId: Number(row.topicId),
    identity: row.identity,
    role: row.role,
    status: row.status,
    grantedBy: row.grantedBy,
    createdAt: Number(row.createdAt ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTopicModeratorApplication(row: any): TopicModeratorApplication {
  return {
    id: Number(row.id),
    topicId: Number(row.topicId),
    applicantIdentity: row.applicantIdentity,
    message: row.message,
    status: row.status,
    reviewedBy: row.reviewedBy,
    createdAt: Number(row.createdAt ?? 0),
    reviewedAt: Number(row.reviewedAt ?? 0),
  };
}

let statsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedRecomputeStats() {
  if (statsDebounceTimer) return;
  statsDebounceTimer = setTimeout(() => {
    statsDebounceTimer = null;
    recomputeStats();
  }, 200);
}

function recomputeStats() {
  const { blocks, setStats, setTopBlocks } = useBlocksStore.getState();
  const claimed: StoreBlock[] = [];

  for (const b of blocks.values()) {
    if (b.status === BlockStatus.Claimed) claimed.push(b);
  }

  const totalLikes = claimed.reduce((sum, b) => sum + b.likes, 0);
  setStats(claimed.length, totalLikes);

  const top = [...claimed].sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes)).slice(0, 10);
  setTopBlocks(top);
}

function bulkLoadTopics(conn: DbConnection) {
  const allTopics: Topic[] = [];
  for (const row of conn.db.topic.iter()) {
    allTopics.push(mapTopic(row));
  }
  useTopicStore.getState().setTopics(allTopics);
  console.log(`[SpacetimeDB] topics loaded over WS: ${allTopics.length}`);
}

function bulkLoadTopicTaxonomy(conn: DbConnection) {
  const allNodes: TopicTaxonomyNode[] = [];
  for (const row of conn.db.topic_taxonomy_node.iter()) {
    allNodes.push(mapTaxonomyNode(row));
  }
  useTopicStore.getState().setTaxonomyNodes(allNodes);
}

function bulkLoadTopicModerators(conn: DbConnection) {
  const all: TopicModerator[] = [];
  for (const row of conn.db.topic_moderator.iter()) {
    all.push(mapTopicModerator(row));
  }
  useTopicStore.getState().setModerators(all);
}

function bulkLoadTopicModeratorApplications(conn: DbConnection) {
  const all: TopicModeratorApplication[] = [];
  for (const row of conn.db.topic_moderator_application.iter()) {
    all.push(mapTopicModeratorApplication(row));
  }
  useTopicStore.getState().setModeratorApplications(all);
}

function bulkLoadComments(conn: DbConnection) {
  const all = [];
  for (const row of conn.db.comment.iter()) {
    all.push({
      id: Number(row.id),
      blockId: Number(row.blockId),
      userIdentity: row.userIdentity,
      userName: row.userName,
      text: row.text,
      createdAt: Number(row.createdAt),
      parentCommentId: row.parentCommentId != null ? Number(row.parentCommentId) : null,
      repostOfId: row.repostOfId != null ? Number(row.repostOfId) : null,
      likesCount: Number(row.likesCount ?? 0),
      repliesCount: Number(row.repliesCount ?? 0),
      repostsCount: Number(row.repostsCount ?? 0),
    });
  }
  if (all.length > 0) {
    useCommentsStore.getState().setComments(all);
  }
}

function bulkLoadCommentLikes(conn: DbConnection) {
  const all = [];
  for (const row of conn.db.comment_like.iter()) {
    all.push({
      id: Number(row.id),
      commentId: Number(row.commentId),
      userIdentity: row.userIdentity,
      createdAt: Number(row.createdAt),
    });
  }
  if (all.length > 0) {
    useCommentsStore.getState().setCommentLikes(all);
  }
}

function bulkLoadNotifications(conn: DbConnection) {
  const all = [];
  for (const row of conn.db.notification.iter()) {
    all.push({
      id: Number(row.id),
      recipientIdentity: row.recipientIdentity,
      actorIdentity: row.actorIdentity,
      actorName: row.actorName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notificationType: row.notificationType as any,
      blockId: Number(row.blockId),
      commentId: Number(row.commentId),
      isRead: row.isRead,
      createdAt: Number(row.createdAt),
    });
  }
  if (all.length > 0) {
    useNotificationsStore.getState().setNotifications(all);
  }
}

function registerTableCallbacks(conn: DbConnection) {
  const { setActiveContest, setWinners } = useContestStore.getState();

  conn.db.block.onInsert((_ctx, row) => {
    const block = mapBlock(row);
    useBlocksStore.getState().setBlock(block);
    debouncedRecomputeStats();
  });

  conn.db.block.onUpdate((_ctx, _old, row) => {
    const block = mapBlock(row);
    useBlocksStore.getState().setBlock(block);
    debouncedRecomputeStats();
  });

  conn.db.block.onDelete((_ctx, row) => {
    useBlocksStore.getState().removeBlock(Number(row.id));
    debouncedRecomputeStats();
  });

  conn.db.topic.onInsert((_ctx, row) => {
    useTopicStore.getState().setTopic(mapTopic(row));
  });

  conn.db.topic.onUpdate((_ctx, _old, row) => {
    const topic = mapTopic(row);
    useTopicStore.getState().setTopic(topic);
    // Update activeTopic if it's the one that changed
    const active = useTopicStore.getState().activeTopic;
    if (active && active.id === topic.id) {
      useTopicStore.getState().setActiveTopic(topic);
    }
  });

  conn.db.topic.onDelete((_ctx, row) => {
    useTopicStore.getState().deleteTopic(Number(row.id));
  });

  conn.db.topic_taxonomy_node.onInsert((_ctx, row) => {
    const { taxonomyNodes } = useTopicStore.getState();
    taxonomyNodes.set(Number(row.id), mapTaxonomyNode(row));
    useTopicStore.getState().setTaxonomyNodes([...taxonomyNodes.values()]);
  });

  conn.db.topic_taxonomy_node.onUpdate((_ctx, _old, row) => {
    const { taxonomyNodes } = useTopicStore.getState();
    taxonomyNodes.set(Number(row.id), mapTaxonomyNode(row));
    useTopicStore.getState().setTaxonomyNodes([...taxonomyNodes.values()]);
  });

  conn.db.topic_taxonomy_node.onDelete((_ctx, row) => {
    const { taxonomyNodes } = useTopicStore.getState();
    taxonomyNodes.delete(Number(row.id));
    useTopicStore.getState().setTaxonomyNodes([...taxonomyNodes.values()]);
  });

  conn.db.topic_moderator.onInsert((_ctx, row) => {
    const { moderators } = useTopicStore.getState();
    moderators.set(Number(row.id), mapTopicModerator(row));
    useTopicStore.getState().setModerators([...moderators.values()]);
  });

  conn.db.topic_moderator.onUpdate((_ctx, _old, row) => {
    const { moderators } = useTopicStore.getState();
    moderators.set(Number(row.id), mapTopicModerator(row));
    useTopicStore.getState().setModerators([...moderators.values()]);
  });

  conn.db.topic_moderator.onDelete((_ctx, row) => {
    const { moderators } = useTopicStore.getState();
    moderators.delete(Number(row.id));
    useTopicStore.getState().setModerators([...moderators.values()]);
  });

  conn.db.topic_moderator_application.onInsert((_ctx, row) => {
    const { moderatorApplications } = useTopicStore.getState();
    moderatorApplications.set(Number(row.id), mapTopicModeratorApplication(row));
    useTopicStore.getState().setModeratorApplications([...moderatorApplications.values()]);
  });

  conn.db.topic_moderator_application.onUpdate((_ctx, _old, row) => {
    const { moderatorApplications } = useTopicStore.getState();
    moderatorApplications.set(Number(row.id), mapTopicModeratorApplication(row));
    useTopicStore.getState().setModeratorApplications([...moderatorApplications.values()]);
  });

  conn.db.topic_moderator_application.onDelete((_ctx, row) => {
    const { moderatorApplications } = useTopicStore.getState();
    moderatorApplications.delete(Number(row.id));
    useTopicStore.getState().setModeratorApplications([...moderatorApplications.values()]);
  });

  conn.db.comment.onInsert((_ctx, row) => {
    useCommentsStore.getState().addComment({
      id: Number(row.id),
      blockId: Number(row.blockId),
      userIdentity: row.userIdentity,
      userName: row.userName,
      text: row.text,
      createdAt: Number(row.createdAt),
      parentCommentId: row.parentCommentId != null ? Number(row.parentCommentId) : null,
      repostOfId: row.repostOfId != null ? Number(row.repostOfId) : null,
      likesCount: Number(row.likesCount ?? 0),
      repliesCount: Number(row.repliesCount ?? 0),
      repostsCount: Number(row.repostsCount ?? 0),
    });
  });

  conn.db.comment.onUpdate((_ctx, _old, row) => {
    useCommentsStore.getState().updateComment({
      id: Number(row.id),
      blockId: Number(row.blockId),
      userIdentity: row.userIdentity,
      userName: row.userName,
      text: row.text,
      createdAt: Number(row.createdAt),
      parentCommentId: row.parentCommentId != null ? Number(row.parentCommentId) : null,
      repostOfId: row.repostOfId != null ? Number(row.repostOfId) : null,
      likesCount: Number(row.likesCount ?? 0),
      repliesCount: Number(row.repliesCount ?? 0),
      repostsCount: Number(row.repostsCount ?? 0),
    });
  });

  conn.db.comment.onDelete((_ctx, row) => {
    useCommentsStore.getState().removeComment(Number(row.id));
  });

  conn.db.comment_like.onInsert((_ctx, row) => {
    useCommentsStore.getState().addCommentLike({
      id: Number(row.id),
      commentId: Number(row.commentId),
      userIdentity: row.userIdentity,
      createdAt: Number(row.createdAt),
    });
  });

  conn.db.comment_like.onDelete((_ctx, row) => {
    useCommentsStore.getState().removeCommentLike(Number(row.id));
  });

  conn.db.notification.onInsert((_ctx, row) => {
    useNotificationsStore.getState().addNotification({
      id: Number(row.id),
      recipientIdentity: row.recipientIdentity,
      actorIdentity: row.actorIdentity,
      actorName: row.actorName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notificationType: row.notificationType as any,
      blockId: Number(row.blockId),
      commentId: Number(row.commentId),
      isRead: row.isRead,
      createdAt: Number(row.createdAt),
    });
  });

  conn.db.notification.onUpdate((_ctx, _old, row) => {
    useNotificationsStore.getState().updateNotification({
      id: Number(row.id),
      recipientIdentity: row.recipientIdentity,
      actorIdentity: row.actorIdentity,
      actorName: row.actorName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notificationType: row.notificationType as any,
      blockId: Number(row.blockId),
      commentId: Number(row.commentId),
      isRead: row.isRead,
      createdAt: Number(row.createdAt),
    });
  });

  conn.db.contest.onInsert((_ctx, row) => {
    if (row.status === "active") {
      setActiveContest({
        id: String(row.id),
        startAt: Number(row.startAt),
        endAt: Number(row.endAt),
        prizePool: Number(row.prizePool),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: row.status as any,
      });
    }
  });

  conn.db.contest.onUpdate((_ctx, _old, row) => {
    setActiveContest({
      id: String(row.id),
      startAt: Number(row.startAt),
      endAt: Number(row.endAt),
      prizePool: Number(row.prizePool),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: row.status as any,
    });
  });

  conn.db.contest_winner.onInsert((_ctx, row) => {
    const { winners } = useContestStore.getState();
    setWinners([
      ...winners,
      {
        blockId: Number(row.blockId),
        videoId: row.videoId,
        platform: row.platform,
        ownerName: row.ownerName,
        ownerIdentity: row.ownerIdentity,
        likes: Number(row.likes),
        rank: row.rank,
        prizeAmount: Number(row.prizeAmount),
      },
    ]);
  });

  conn.db.user_profile.onInsert((_ctx, row) => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser && row.identity === currentUser.identity) {
      useAuthStore.getState().setUser({
        identity: row.identity,
        clerkUserId: row.clerkUserId || null,
        username: row.username || null,
        displayName: row.displayName,
        email: row.email || null,
        imageUrl: currentUser.imageUrl,
        stripeAccountId: row.stripeAccountId || null,
        totalEarnings: Number(row.totalEarnings),
        credits: Number(row.credits ?? 0),
        isAdmin: row.isAdmin,
      });
    }
  });

  conn.db.user_profile.onUpdate((_ctx, _old, row) => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser && row.identity === currentUser.identity) {
      useAuthStore.getState().setUser({
        identity: row.identity,
        clerkUserId: row.clerkUserId || null,
        username: row.username || null,
        displayName: row.displayName,
        email: row.email || null,
        imageUrl: currentUser.imageUrl,
        stripeAccountId: row.stripeAccountId || null,
        totalEarnings: Number(row.totalEarnings),
        credits: Number(row.credits ?? 0),
        isAdmin: row.isAdmin,
      });
    }
  });
}

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

export function SpacetimeDBProvider({ children }: { children: ReactNode }) {
  const prevToken = useRef<string | undefined>(undefined);
  const { oidcToken, isLoading: authLoading, isAuthenticated, user: authUser } = useAuth();

  // Keep a stable ref to the latest Clerk-sourced user fields so onConnect
  // can read them without depending on Zustand state.
  const clerkUserRef = useRef<{ email: string | null; username: string | null; displayName: string; imageUrl: string | null }>({
    email: null,
    username: null,
    displayName: "User",
    imageUrl: null,
  });
  useEffect(() => {
    if (authUser) {
      clerkUserRef.current = {
        email: authUser.email,
        username: authUser.username ?? null,
        displayName: authUser.displayName,
        imageUrl: authUser.imageUrl ?? null,
      };
    }
  }, [authUser, authUser?.email, authUser?.username, authUser?.displayName, authUser?.imageUrl]);

  const callbacks: ConnectionCallbacks = {
    onConnect: (connection, identity) => {
      console.log("[SpacetimeDB] connected as", identity.toHexString());
      registerTableCallbacks(connection);
      bulkLoadTopics(connection);
      bulkLoadTopicTaxonomy(connection);
      bulkLoadTopicModerators(connection);
      bulkLoadTopicModeratorApplications(connection);
      bulkLoadComments(connection);
      bulkLoadCommentLikes(connection);
      bulkLoadNotifications(connection);
      subscribeToNotifications(identity.toHexString());

      const clerkEmail = clerkUserRef.current.email;
      const clerkUsername = clerkUserRef.current.username;
      const clerkDisplayName = clerkUserRef.current.displayName;
      const clerkImageUrl = clerkUserRef.current.imageUrl;
      const clerkUserId = useAuthStore.getState().clerkUserId ?? "";
      console.log("[SpacetimeDB] onConnect — clerkUserRef:", { email: clerkEmail ?? "(null)", username: clerkUsername ?? "(null)", displayName: clerkDisplayName });

      const profile = connection.db.user_profile.identity.find(identity.toHexString());
      if (profile) {
        const userData = {
          identity: identity.toHexString(),
          clerkUserId: profile.clerkUserId || clerkUserId || null,
          username: profile.username || clerkUsername || null,
          displayName: profile.displayName || clerkDisplayName,
          email: profile.email || clerkEmail,
          imageUrl: clerkImageUrl,
          stripeAccountId: profile.stripeAccountId || null,
          totalEarnings: Number(profile.totalEarnings),
          credits: Number(profile.credits ?? 0),
          isAdmin: profile.isAdmin,
        };
        useAuthStore.getState().setUser(userData);
        localStorage.setItem("spacetimedb_user", JSON.stringify(userData));

        if (!profile.email || !profile.displayName || !profile.username) {
          const username = profile.username || clerkUsername || "";
          const displayName = profile.displayName || clerkDisplayName;
          const email = profile.email || clerkEmail || "";
          console.log("[SpacetimeDB] updateProfile — passing:", { username, displayName, email });
          connection.reducers.updateProfile({ username, displayName, email });
        }
      } else {
        const username = clerkUsername || "";
        const displayName = clerkDisplayName;
        const email = clerkEmail || "";
        console.log("[SpacetimeDB] registerUser — passing:", { clerkUserId, username, displayName, email: email || "(empty)" });

        useAuthStore.getState().setUser({
          identity: identity.toHexString(),
          clerkUserId: clerkUserId || null,
          username: clerkUsername,
          displayName,
          email: email || null,
          imageUrl: clerkImageUrl,
          stripeAccountId: null,
          totalEarnings: 0,
          credits: 0,
          isAdmin: false,
        });

        connection.reducers.registerUser({ clerkUserId, username, displayName, email });
        useAuthStore.getState().setLoading(false);
      }

      if (clerkUserId) {
        console.log("[SpacetimeDB] storeClerkMapping:", clerkUserId);
        connection.reducers.storeClerkMapping({ clerkUserId });
      }
    },
    onDisconnect: () => {
      console.log("[SpacetimeDB] disconnected");
    },
    onConnectError: (error) => {
      console.error("[SpacetimeDB] connection error:", error);
      useAuthStore.getState().setLoading(false);
    },
  };

  useEffect(() => {
    // In mock-data mode the store is seeded by MockDataLoader — skip SpacetimeDB
    // so a logged-in user's real data (few real topics) doesn't overwrite the 10k mock set.
    if (USE_MOCK) return;
    if (authLoading) return;
    if (!isAuthenticated || !oidcToken) {
      console.log("[SpacetimeDB] skipping connect:", { authLoading, isAuthenticated, hasToken: !!oidcToken });
      return;
    }

    if (prevToken.current === oidcToken) return;
    const isReconnect = prevToken.current !== undefined;
    prevToken.current = oidcToken;

    if (isReconnect) {
      console.log("[SpacetimeDB] OIDC token refreshed, reconnecting...");
      reconnect(callbacks, oidcToken).catch((err) => {
        console.error("[SpacetimeDB] reconnect failed:", err);
        useAuthStore.getState().setLoading(false);
      });
    } else {
      connect(callbacks, oidcToken).catch((err) => {
        console.error("[SpacetimeDB] failed to connect:", err);
        useAuthStore.getState().setLoading(false);
      });
    }

    return () => {
      disconnect();
      prevToken.current = undefined;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, oidcToken]);

  // Anonymous users: load topics via HTTP so the home page and topic pages render
  useEffect(() => {
    if (USE_MOCK) return;  // mock data is already loaded by MockDataLoader
    if (authLoading || isAuthenticated) return;
    fetch("/api/v1/topics")
      .then((r) => r.json())
      .then((d: { topics?: Topic[] }) => {
        if (d.topics?.length) {
          useTopicStore.getState().setTopics(d.topics);
          console.log(`[SpacetimeDB] anonymous topics loaded: ${d.topics.length}`);
        }
        useAuthStore.getState().setLoading(false);
      })
      .catch((err) => {
        console.error("[SpacetimeDB] anonymous topics fetch failed:", err);
        useAuthStore.getState().setLoading(false);
      });
  }, [authLoading, isAuthenticated]);

  return <>{children}</>;
}

/**
 * Hook: subscribe to all blocks for a topic when the component mounts and
 * unsubscribe when it unmounts (or topicId changes).
 */
export function useTopicBlocksSubscription(topicId: number | null) {
  useEffect(() => {
    if (!topicId) return;

    // ── Mock mode: build blocks from related topics already in the topic store ──
    if (USE_MOCK) {
      const { setBlocks, setLoading } = useBlocksStore.getState();
      setLoading(true);

      // Defer one tick so the topic page can finish rendering first
      const timer = setTimeout(() => {
        const { topics } = useTopicStore.getState();
        const currentTopic = topics.get(topicId);

        // Gather sibling topics from the same taxonomy leaf node,
        // then fall back to same category, capped at 200.
        const pool = [...topics.values()].filter((t) =>
          t.id !== topicId &&
          t.thumbnailVideoId &&
          (
            (currentTopic?.taxonomyNodeId != null && t.taxonomyNodeId === currentTopic.taxonomyNodeId) ||
            t.category === currentTopic?.category
          )
        ).slice(0, 200);

        const coords = batchSpiralCoordinates(pool.length);

        const blocks: StoreBlock[] = pool.map((t, i) => ({
          id: topicId * 100_000 + i + 1,
          topicId,
          x: coords[i]?.x ?? i,
          y: coords[i]?.y ?? 0,
          videoId: t.thumbnailVideoId ?? null,
          platform: Platform.YouTube,
          ownerIdentity: t.creatorIdentity,
          ownerName: `@${t.creatorIdentity}`,
          likes: Math.round(t.totalLikes / 10),
          dislikes: Math.round(t.totalDislikes / 10),
          ytViews: Math.round(t.totalViews / 10),
          ytLikes: Math.round(t.totalLikes / 10),
          thumbnailUrl: t.thumbnailUrl ?? null,
          status: BlockStatus.Claimed,
          adImageUrl: null,
          adLinkUrl: null,
          claimedAt: t.createdAt,
        }));

        setBlocks(blocks);
        setLoading(false);
      }, 50);

      return () => {
        clearTimeout(timer);
        useBlocksStore.getState().setBlocks([]);
        useBlocksStore.getState().setLoading(true);
      };
    }

    // ── Live SpacetimeDB path (unchanged) ──────────────────────────────────────
    const conn = getConnection();
    if (!conn) return;

    import("@/lib/spacetimedb/client").then(({ subscribeToTopicBlocks }) => {
      subscribeToTopicBlocks(topicId, () => {
        const c = getConnection();
        if (!c) return;
        const { setBlocks, setLoading } = useBlocksStore.getState();
        const blocks: StoreBlock[] = [];
        for (const row of c.db.block.iter()) {
          blocks.push(mapBlock(row));
        }
        setBlocks(blocks);
        setLoading(false);
      });
    });

    return () => {
      import("@/lib/spacetimedb/client").then(({ unsubscribeFromTopicBlocks }) => {
        unsubscribeFromTopicBlocks();
        useBlocksStore.getState().setBlocks([]);
        useBlocksStore.getState().setLoading(true);
      });
    };
  }, [topicId]);
}
