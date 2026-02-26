"use client";

import { useBlocksStore } from "@/stores/blocks-store";
import { useContestStore } from "@/stores/contest-store";
import { TOTAL_BLOCKS } from "@/lib/constants";

export function StatsBar() {
  const { totalClaimed, totalLikes } = useBlocksStore();
  const { activeContest } = useContestStore();

  const fillPercent = ((totalClaimed / TOTAL_BLOCKS) * 100).toFixed(1);

  return (
    <div className="pointer-events-auto absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-border bg-surface/90 px-4 py-2 shadow-xl backdrop-blur-sm">
      <div className="text-center">
        <p className="text-xs text-muted">Blocks Used</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {totalClaimed.toLocaleString()}{" "}
          <span className="text-muted font-normal">
            / {TOTAL_BLOCKS.toLocaleString()}
          </span>
        </p>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="text-center">
        <p className="text-xs text-muted">Fill</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {fillPercent}%
        </p>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="text-center">
        <p className="text-xs text-muted">Likes</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {totalLikes.toLocaleString()}
        </p>
      </div>

      {activeContest && (
        <>
          <div className="h-6 w-px bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted">Prize</p>
            <p className="text-sm font-semibold tabular-nums text-green-400">
              ${(activeContest.prizePool / 100).toFixed(0)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
