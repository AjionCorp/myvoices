"use client";

import { useState } from "react";
import { useContestStore } from "@/stores/contest-store";

export default function ContestsManagement() {
  const { activeContest, winners, leaderboard } = useContestStore();

  const [durationDays, setDurationDays] = useState(30);
  const [prizePool, setPrizePool] = useState(1000);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      // SpacetimeDB reducer: create_contest(durationDays, prizePool * 100)
      console.log("Creating contest:", { durationDays, prizePool });
    } finally {
      setIsCreating(false);
    }
  };

  const handleFinalize = async () => {
    if (!activeContest) return;
    // SpacetimeDB reducer: finalize_contest(activeContest.id)
    console.log("Finalizing contest:", activeContest.id);
  };

  const handlePayout = async (winnerIdentity: string, amount: number, stripeAccountId: string) => {
    try {
      const res = await fetch("/api/stripe/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectedAccountId: stripeAccountId,
          amountCents: amount,
          description: `Contest #${activeContest?.id} prize payout`,
        }),
      });

      if (res.ok) {
        console.log("Payout initiated for", winnerIdentity);
      }
    } catch (err) {
      console.error("Payout error:", err);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Contest Management
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {activeContest ? "Active Contest" : "Create Contest"}
          </h2>

          {activeContest ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-surface-light p-3">
                  <p className="text-xs text-muted">Status</p>
                  <p className="text-sm font-medium capitalize text-foreground">
                    {activeContest.status}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-light p-3">
                  <p className="text-xs text-muted">Prize Pool</p>
                  <p className="text-sm font-medium text-foreground">
                    ${(activeContest.prizePool / 100).toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-light p-3">
                  <p className="text-xs text-muted">Start</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(activeContest.startAt / 1000).toLocaleDateString()}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-light p-3">
                  <p className="text-xs text-muted">End</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(activeContest.endAt / 1000).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {activeContest.status === "active" && (
                <button
                  onClick={handleFinalize}
                  className="w-full rounded-lg border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
                >
                  Finalize Contest
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">
                  Duration (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 30)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">
                  Prize Pool ($)
                </label>
                <input
                  type="number"
                  min={1}
                  value={prizePool}
                  onChange={(e) => setPrizePool(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Start Contest"}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Winners
          </h2>
          {winners.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">
              {activeContest
                ? "Contest is still active. Winners will appear here after finalization."
                : "No contest winners yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {winners.map((winner) => (
                <div
                  key={winner.blockId}
                  className="rounded-lg border border-border bg-surface-light p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                          winner.rank === 1 ? "bg-yellow-500" : "bg-gray-500"
                        }`}
                      >
                        #{winner.rank}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {winner.ownerName}
                        </p>
                        <p className="text-xs text-muted">
                          {winner.likes.toLocaleString()} likes
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-green-400">
                      ${(winner.prizeAmount / 100).toFixed(2)}
                    </span>
                  </div>
                  {winner.thumbnailUrl && (
                    <img
                      src={winner.thumbnailUrl}
                      alt=""
                      className="w-full rounded-lg"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
