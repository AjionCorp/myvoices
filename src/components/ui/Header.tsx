"use client";

import Link from "next/link";
import { LoginButton } from "@/components/auth/LoginButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { useBlocksStore } from "@/stores/blocks-store";
import { useContestStore } from "@/stores/contest-store";
import { TOTAL_BLOCKS } from "@/lib/constants";

export function Header() {
  const { user } = useAuth();
  const { totalClaimed } = useBlocksStore();
  const { activeContest, timeRemaining } = useContestStore();

  const formatTime = (ms: number | null): string => {
    if (!ms || ms <= 0) return "Ended";
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <header className="pointer-events-auto absolute left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            mV
          </div>
          <span className="text-lg font-bold text-foreground">myVoice</span>
        </Link>

        <div className="hidden items-center gap-3 sm:flex">
          <span className="rounded-md bg-surface px-2 py-1 text-xs tabular-nums text-muted">
            {totalClaimed.toLocaleString()}/{(TOTAL_BLOCKS / 1000).toFixed(0)}K blocks
          </span>

          {activeContest && (
            <span className="flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-1 text-xs text-accent-light">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-light" />
              {formatTime(timeRemaining)} left
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user?.isAdmin && (
          <Link
            href="/admin"
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-foreground hover:text-foreground"
          >
            Admin
          </Link>
        )}
        <LoginButton />
      </div>
    </header>
  );
}
