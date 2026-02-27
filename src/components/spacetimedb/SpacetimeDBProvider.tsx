"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { connect, disconnect, reconnect, type ConnectionCallbacks } from "@/lib/spacetimedb/client";
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
  const didConnect = useRef(false);
  const prevToken = useRef<string | null>(null);
  const { oidcToken } = useAuth();

  const callbacks: ConnectionCallbacks = {
    onConnect: (conn, identity, token) => {
      console.log("[SpacetimeDB] connected as", identity.toHexString());
      registerTableCallbacks(conn);
      bulkLoadBlocks(conn);
      bulkLoadComments(conn);

      const profile = conn.db.user_profile.identity.find(identity.toHexString());
      if (profile) {
        const userData = {
          identity: profile.identity,
          displayName: profile.displayName,
          email: profile.email || null,
          stripeAccountId: profile.stripeAccountId || null,
          totalEarnings: Number(profile.totalEarnings),
          isAdmin: profile.isAdmin,
        };
        useAuthStore.getState().setUser(userData);
        localStorage.setItem("spacetimedb_user", JSON.stringify(userData));
      } else {
        useAuthStore.getState().setLoading(false);
      }
    },
    onDisconnect: () => {
      console.log("[SpacetimeDB] disconnected");
      didConnect.current = false;
    },
    onConnectError: (error) => {
      console.error("[SpacetimeDB] connection error:", error);
      didConnect.current = false;
      useAuthStore.getState().setLoading(false);
    },
  };

  // Initial connection
  useEffect(() => {
    if (didConnect.current) return;
    didConnect.current = true;
    prevToken.current = oidcToken;

    connect(callbacks, oidcToken).catch((err) => {
      console.error("[SpacetimeDB] failed to connect:", err);
      useAuthStore.getState().setLoading(false);
    });

    return () => {
      disconnect();
      didConnect.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnect when OIDC token refreshes (silent renew)
  useEffect(() => {
    if (!oidcToken || oidcToken === prevToken.current) return;
    prevToken.current = oidcToken;

    if (didConnect.current) {
      console.log("[SpacetimeDB] OIDC token refreshed, reconnecting...");
      didConnect.current = false;
      reconnect(callbacks, oidcToken)
        .then(() => { didConnect.current = true; })
        .catch((err) => {
          console.error("[SpacetimeDB] reconnect failed:", err);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oidcToken]);

  return <>{children}</>;
}
