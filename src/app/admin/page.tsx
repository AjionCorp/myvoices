"use client";

import { useBlocksStore } from "@/stores/blocks-store";
import { useContestStore } from "@/stores/contest-store";
import { TOTAL_BLOCKS, Platform } from "@/lib/constants";
import { getThumbnailUrl } from "@/lib/utils/video-url";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="mb-1 text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default function AdminOverview() {
  const { totalClaimed, totalLikes, topBlocks } = useBlocksStore();
  const { activeContest, leaderboard } = useContestStore();

  const fillRate = ((totalClaimed / TOTAL_BLOCKS) * 100).toFixed(2);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Dashboard Overview
      </h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Blocks"
          value={TOTAL_BLOCKS.toLocaleString()}
          sub="1,000 x 1,000 grid"
        />
        <StatCard
          label="Claimed Blocks"
          value={totalClaimed.toLocaleString()}
          sub={`${fillRate}% fill rate`}
        />
        <StatCard
          label="Total Likes"
          value={totalLikes.toLocaleString()}
        />
        <StatCard
          label="Contest Status"
          value={activeContest?.status || "None"}
          sub={
            activeContest
              ? `Prize: $${(activeContest.prizePool / 100).toFixed(2)}`
              : "No active contest"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Top Videos
          </h2>
          {topBlocks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No videos submitted yet
            </p>
          ) : (
            <div className="space-y-3">
              {topBlocks.slice(0, 10).map((block, i) => (
                <div
                  key={block.id}
                  className="flex items-center gap-3 rounded-lg bg-surface-light p-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-light">
                    {i + 1}
                  </span>
                  {block.videoId && block.platform && getThumbnailUrl(block.videoId, block.platform as Platform) && (
                    <img
                      src={getThumbnailUrl(block.videoId, block.platform as Platform)!}
                      alt=""
                      className="h-10 w-14 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {block.ownerName || `Block #${block.id}`}
                    </p>
                    <p className="text-xs text-muted">
                      {block.likes.toLocaleString()} likes
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Leaderboard
          </h2>
          {leaderboard.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No contest activity yet
            </p>
          ) : (
            <div className="space-y-2">
              {leaderboard.slice(0, 15).map((entry, i) => (
                <div
                  key={entry.blockId}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-light"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-right text-xs tabular-nums text-muted">
                      {i + 1}.
                    </span>
                    <span className="text-sm text-foreground">
                      {entry.ownerName}
                    </span>
                  </div>
                  <span className="text-sm tabular-nums text-muted">
                    {entry.likes.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
