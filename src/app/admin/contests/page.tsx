"use client";

import { useState } from "react";
import { useContestStore } from "@/stores/contest-store";
import { Platform } from "@/lib/constants";
import { getThumbnailUrl } from "@/lib/utils/video-url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getConnection } from "@/lib/spacetimedb/client";

export default function ContestsManagement() {
  const { activeContest, winners, leaderboard } = useContestStore();

  const [durationDays, setDurationDays] = useState(30);
  const [prizePool, setPrizePool] = useState(1000);
  const [isCreating, setIsCreating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const conn = getConnection();
      if (!conn) { setError("Not connected"); return; }
      conn.reducers.createContest({
        durationDays: BigInt(durationDays),
        prizePool: BigInt(prizePool * 100),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create contest");
    } finally {
      setIsCreating(false);
    }
  };

  const handleFinalize = async () => {
    if (!activeContest) return;
    setError(null);
    try {
      const conn = getConnection();
      if (!conn) { setError("Not connected"); return; }
      conn.reducers.finalizeContest({ contestId: BigInt(activeContest.id) });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to finalize contest");
    }
  };

  const handlePayout = async (winnerIdentity: string, amount: number, stripeAccountId: string) => {
    try {
      const res = await fetch("/api/v1/stripe/payout", {
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

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader>
            <CardTitle className="text-lg">{activeContest ? "Active Contest" : "Create Contest"}</CardTitle>
          </CardHeader>
          <CardContent>

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
                <Button
                  onClick={handleFinalize}
                  variant="destructive"
                  className="w-full border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                >
                  Finalize Contest
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">
                  Duration (days)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 30)}
                  className="bg-background"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">
                  Prize Pool ($)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={prizePool}
                  onChange={(e) => setPrizePool(parseInt(e.target.value, 10) || 0)}
                  className="bg-background"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? "Creating..." : "Start Contest"}
              </Button>
            </div>
          )}
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader>
            <CardTitle className="text-lg">Winners</CardTitle>
          </CardHeader>
          <CardContent>
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
                      <Badge
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                          winner.rank === 1 ? "bg-yellow-500" : "bg-gray-500"
                        }`}
                      >
                        #{winner.rank}
                      </Badge>
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
                  {winner.videoId && getThumbnailUrl(winner.videoId, winner.platform as Platform) && (
                    <img
                      src={getThumbnailUrl(winner.videoId, winner.platform as Platform)!}
                      alt=""
                      className="w-full rounded-lg"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
