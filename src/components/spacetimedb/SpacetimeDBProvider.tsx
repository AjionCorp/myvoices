"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { connect, disconnect, reconnect, getConnection, type ConnectionCallbacks, VIEWPORT_SUBSCRIPTION_THRESHOLD } from "@/lib/spacetimedb/client";
import { ViewportSubscriptionManager } from "@/lib/spacetimedb/ViewportSubscriptionManager";
import { AnonymousViewportFetcher } from "@/lib/spacetimedb/AnonymousViewportFetcher";
import { useBlocksStore, type Block as StoreBlock } from "@/stores/blocks-store";
import { useContestStore } from "@/stores/contest-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCommentsStore } from "@/stores/comments-store";
import { BlockStatus, type Platform, rebuildAdLayout } from "@/lib/constants";
import { useAuth } from "@/components/auth/AuthProvider";
import type { DbConnection } from "@/module_bindings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBlock(row: any): StoreBlock {
  return {
    id: row.id,
    x: row.x,
    y: row.y,
    videoId: row.videoId || null,
    platform: (row.platform || null) as Platform | null,
    ownerIdentity: row.ownerIdentity || null,
    ownerName: row.ownerName || null,
    likes: Number(row.likes ?? 0),
    dislikes: Number(row.dislikes ?? 0),
    status: (row.status as BlockStatus) || BlockStatus.Empty,
    adImageUrl: row.adImageUrl || null,
    adLinkUrl: row.adLinkUrl || null,
    claimedAt: row.claimedAt ? Number(row.claimedAt) : null,
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

  rebuildAdLayout(claimed.length);
  const totalLikes = claimed.reduce((sum, b) => sum + b.likes, 0);
  setStats(claimed.length, totalLikes);

  const top = [...claimed].sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes)).slice(0, 10);
  setTopBlocks(top);
}

function bulkLoadBlocks(conn: DbConnection) {
  const allBlocks: StoreBlock[] = [];
  for (const row of conn.db.block.iter()) {
    allBlocks.push(mapBlock(row));
  }

  if (allBlocks.length > 0) {
    console.log(`[SpacetimeDB] Bulk loading ${allBlocks.length} blocks`);
    useBlocksStore.getState().setBlocks(allBlocks);
    recomputeStats();
    useBlocksStore.getState().setLoading(false);
  } else {
    useBlocksStore.getState().setLoading(false);
  }
}

function bulkLoadComments(conn: DbConnection) {
  const all: Array<{ id: number; blockId: number; userIdentity: string; userName: string; text: string; createdAt: number }> = [];
  for (const row of conn.db.comment.iter()) {
    all.push({
      id: Number(row.id),
      blockId: row.blockId,
      userIdentity: row.userIdentity,
      userName: row.userName,
      text: row.text,
      createdAt: Number(row.createdAt),
    });
  }
  if (all.length > 0) {
    useCommentsStore.getState().setComments(all);
  }
}

function registerTableCallbacks(conn: DbConnection) {
  const { setBlock } = useBlocksStore.getState();
  const { setActiveContest, setWinners } = useContestStore.getState();

  conn.db.block.onInsert((_ctx, row) => {
    setBlock(mapBlock(row));
    debouncedRecomputeStats();
  });

  conn.db.block.onUpdate((_ctx, _old, row) => {
    setBlock(mapBlock(row));
    debouncedRecomputeStats();
  });

  conn.db.block.onDelete((_ctx, row) => {
    const { blocks } = useBlocksStore.getState();
    blocks.delete(row.id);
    useBlocksStore.setState({ blocks });
    debouncedRecomputeStats();
  });

  conn.db.comment.onInsert((_ctx, row) => {
    useCommentsStore.getState().addComment({
      id: Number(row.id),
      blockId: row.blockId,
      userIdentity: row.userIdentity,
      userName: row.userName,
      text: row.text,
      createdAt: Number(row.createdAt),
    });
  });

  conn.db.comment.onDelete((_ctx, row) => {
    useCommentsStore.getState().removeComment(Number(row.id));
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
        blockId: row.blockId,
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
        displayName: row.displayName,
        email: row.email || null,
        stripeAccountId: row.stripeAccountId || null,
        totalEarnings: Number(row.totalEarnings),
        isAdmin: row.isAdmin,
      });
    }
  });

  conn.db.user_profile.onUpdate((_ctx, _old, row) => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser && row.identity === currentUser.identity) {
      useAuthStore.getState().setUser({
        identity: row.identity,
        displayName: row.displayName,
        email: row.email || null,
        stripeAccountId: row.stripeAccountId || null,
        totalEarnings: Number(row.totalEarnings),
        isAdmin: row.isAdmin,
      });
    }
  });
}

export function SpacetimeDBProvider({ children }: { children: ReactNode }) {
  const prevToken = useRef<string | undefined>(undefined);
  const blockSubscriptionHandleRef = useRef<{ unsubscribe: () => void } | null>(null);
  const [conn, setConn] = useState<DbConnection | null>(null);
  const { oidcToken, isLoading: authLoading, isAuthenticated, user: authUser } = useAuth();

  // Keep a stable ref to the latest Clerk-sourced user fields so onConnect
  // can read them without depending on Zustand state (which onConnect also writes).
  const clerkUserRef = useRef<{ email: string | null; displayName: string }>({
    email: null,
    displayName: "User",
  });
  useEffect(() => {
    if (authUser) {
      clerkUserRef.current = {
        email: authUser.email,
        displayName: authUser.displayName,
      };
    }
  }, [authUser?.email, authUser?.displayName]);

  const callbacks: ConnectionCallbacks = {
    onBlocksLoaded: () => {
      const c = getConnection();
      if (!c) return;
      bulkLoadBlocks(c);
    },
    onConnect: (connection, identity, token) => {
      setConn(connection);
      console.log("[SpacetimeDB] connected as", identity.toHexString());
      registerTableCallbacks(connection);
      bulkLoadComments(connection);

      // Use the ref so we always have the latest Clerk email/displayName regardless
      // of what Zustand state looks like at this moment.
      const clerkEmail = clerkUserRef.current.email;
      const clerkDisplayName = clerkUserRef.current.displayName;
      console.log("[SpacetimeDB] onConnect — clerkUserRef:", { email: clerkEmail ?? "(null)", displayName: clerkDisplayName });

      // SpacetimeDB identity is a hex string derived from the JWT sub claim —
      // different from Clerk's "user_xxx" ID. Always use this as the canonical identity.
      const profile = connection.db.user_profile.identity.find(identity.toHexString());
      if (profile) {
        const userData = {
          identity: identity.toHexString(),
          displayName: profile.displayName || clerkDisplayName,
          email: profile.email || clerkEmail,
          stripeAccountId: profile.stripeAccountId || null,
          totalEarnings: Number(profile.totalEarnings),
          isAdmin: profile.isAdmin,
        };
        useAuthStore.getState().setUser(userData);
        localStorage.setItem("spacetimedb_user", JSON.stringify(userData));

        // If the stored profile is missing email or displayName (pre-fix data),
        // patch it in SpacetimeDB using the fresh Clerk values.
        if ((!profile.email || !profile.displayName) && clerkEmail) {
          const displayName = profile.displayName || clerkDisplayName;
          console.log("[SpacetimeDB] updateProfile — passing:", { displayName, email: clerkEmail });
          connection.reducers.updateProfile({ displayName, email: clerkEmail });
        }
      } else {
        // First-time user — create their profile in SpacetimeDB.
        const displayName = clerkDisplayName;
        const email = clerkEmail || "";
        console.log("[SpacetimeDB] registerUser — passing:", { displayName, email: email || "(empty)" });

        // Overwrite the Clerk user ID with the real SpacetimeDB identity so
        // the user_profile.onInsert callback matches correctly.
        useAuthStore.getState().setUser({
          identity: identity.toHexString(),
          displayName,
          email: email || null,
          stripeAccountId: null,
          totalEarnings: 0,
          isAdmin: false,
        });

        connection.reducers.registerUser({ displayName, email });
        useAuthStore.getState().setLoading(false);
      }

      // Always store/refresh the Clerk user ID → SpacetimeDB identity mapping
      // so the Clerk webhook can find this user by clerk_user_id.
      const clerkUserId = useAuthStore.getState().clerkUserId;
      if (clerkUserId) {
        console.log("[SpacetimeDB] storeClerkMapping:", clerkUserId);
        connection.reducers.storeClerkMapping({ clerkUserId });
      }
    },
    onDisconnect: () => {
      setConn(null);
      console.log("[SpacetimeDB] disconnected");
    },
    onConnectError: (error) => {
      console.error("[SpacetimeDB] connection error:", error);
      useAuthStore.getState().setLoading(false);
    },
  };

  // Connect only when user is logged in (OIDC token required; anonymous sign-in disabled)
  useEffect(() => {
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

  return (
    <>
      {VIEWPORT_SUBSCRIPTION_THRESHOLD > 0 && (
        <ViewportSubscriptionManager
          conn={conn}
          blockSubscriptionHandleRef={blockSubscriptionHandleRef}
        />
      )}
      {!authLoading && !isAuthenticated && <AnonymousViewportFetcher />}
      {children}
    </>
  );
}
