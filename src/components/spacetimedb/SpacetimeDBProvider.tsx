"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { connect, disconnect, type ConnectionCallbacks } from "@/lib/spacetimedb/client";
import { useBlocksStore, type Block as StoreBlock } from "@/stores/blocks-store";
import { useContestStore } from "@/stores/contest-store";
import { useAuthStore } from "@/stores/auth-store";
import { BlockStatus, type Platform } from "@/lib/constants";
import type { DbConnection } from "@/module_bindings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBlock(row: any): StoreBlock {
  return {
    id: row.id,
    x: row.x,
    y: row.y,
    videoUrl: row.videoUrl || null,
    thumbnailUrl: row.thumbnailUrl || null,
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

function registerTableCallbacks(conn: DbConnection) {
  const { setBlock } = useBlocksStore.getState();
  const { setActiveContest, setWinners } = useContestStore.getState();

  conn.db.block.onInsert((_ctx, row) => {
    setBlock(mapBlock(row));
    recomputeStats();
  });

  conn.db.block.onUpdate((_ctx, _old, row) => {
    setBlock(mapBlock(row));
    recomputeStats();
  });

  conn.db.block.onDelete((_ctx, row) => {
    const { blocks } = useBlocksStore.getState();
    blocks.delete(row.id);
    useBlocksStore.setState({ blocks });
    recomputeStats();
  });

  conn.db.contest.onInsert((_ctx, row) => {
    if (row.status === "active") {
      setActiveContest({
        id: String(row.id),
        startAt: Number(row.startAt),
        endAt: Number(row.endAt),
        prizePool: Number(row.prizePool),
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
      status: row.status as any,
    });
  });

  conn.db.contestWinner.onInsert((_ctx, row) => {
    const { winners } = useContestStore.getState();
    setWinners([
      ...winners,
      {
        blockId: row.blockId,
        videoUrl: row.videoUrl,
        thumbnailUrl: row.thumbnailUrl,
        platform: row.platform,
        ownerName: row.ownerName,
        ownerIdentity: row.ownerIdentity,
        likes: Number(row.likes),
        rank: row.rank,
        prizeAmount: Number(row.prizeAmount),
      },
    ]);
  });

  conn.db.userProfile.onInsert((ctx, row) => {
    if (
      ctx.event.tag === "Reducer" &&
      row.identity === useAuthStore.getState().user?.identity
    ) {
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

  conn.db.userProfile.onUpdate((_ctx, _old, row) => {
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

  useEffect(() => {
    if (didConnect.current) return;
    didConnect.current = true;

    const callbacks: ConnectionCallbacks = {
      onConnect: (conn, identity, token) => {
        console.log("[SpacetimeDB] connected as", identity.toHexString());
        registerTableCallbacks(conn);

        const profile = conn.db.userProfile.identity.find(identity.toHexString());
        if (profile) {
          useAuthStore.getState().setUser({
            identity: profile.identity,
            displayName: profile.displayName,
            email: profile.email || null,
            stripeAccountId: profile.stripeAccountId || null,
            totalEarnings: Number(profile.totalEarnings),
            isAdmin: profile.isAdmin,
          });
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

    try {
      connect(callbacks).catch((err) => {
        if (String(err).includes("Stub module_bindings")) {
          console.info("[SpacetimeDB] Using stub bindings — skipping real-time connection. Run `spacetime generate` to enable.");
        } else {
          console.error("[SpacetimeDB] failed to connect:", err);
        }
      });
    } catch (err) {
      if (String(err).includes("Stub module_bindings")) {
        console.info("[SpacetimeDB] Using stub bindings — skipping real-time connection.");
      } else {
        console.error("[SpacetimeDB] connect error:", err);
      }
      didConnect.current = false;
      useAuthStore.getState().setLoading(false);
    }

    return () => {
      disconnect();
      didConnect.current = false;
    };
  }, []);

  return <>{children}</>;
}
