"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getConnection } from "@/lib/spacetimedb/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface ContestWin {
  id: number;
  contestId: number;
  rank: number;
  prizeAmount: number;
  videoId: string;
  platform: string;
  likes: number;
}

export default function EarningsPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [wins, setWins] = useState<ContestWin[]>([]);
  const [onboarding, setOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  const loadWins = useCallback(() => {
    if (!user) return;
    const conn = getConnection();
    if (!conn) return;
    const list: ContestWin[] = [];
    for (const row of conn.db.contest_winner.iter()) {
      if (row.ownerIdentity === user.identity) {
        list.push({
          id: Number(row.id),
          contestId: Number(row.contestId),
          rank: Number(row.rank),
          prizeAmount: Number(row.prizeAmount),
          videoId: row.videoId,
          platform: row.platform,
          likes: Number(row.likes),
        });
      }
    }
    list.sort((a, b) => b.contestId - a.contestId);
    setWins(list);
  }, [user]);

  useEffect(() => {
    loadWins();
    const conn = getConnection();
    if (!conn) return;
    const handleInsert = () => loadWins();
    const handleUpdate = () => loadWins();
    conn.db.contest_winner.onInsert(handleInsert);
    conn.db.contest_winner.onUpdate(handleUpdate);
    return () => {
      conn.db.contest_winner.removeOnInsert(handleInsert);
      conn.db.contest_winner.removeOnUpdate(handleUpdate);
    };
  }, [loadWins]);

  const handleOnboard = async () => {
    if (!user?.email) {
      setOnboardError("No email found on your account.");
      return;
    }
    setOnboarding(true);
    setOnboardError(null);
    try {
      const res = await fetch("/api/v1/stripe/connect/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOnboardError(data.error || "Failed to start onboarding");
        return;
      }
      // Store the account ID in SpacetimeDB
      const conn = getConnection();
      if (conn && data.accountId) {
        conn.reducers.updateStripeAccount({ stripeAccountId: data.accountId });
      }
      // Redirect to Stripe onboarding
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch {
      setOnboardError("Network error. Please try again.");
    } finally {
      setOnboarding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <h1 className="text-xl font-semibold text-foreground">Sign in to view your earnings</h1>
        <Button asChild>
          <Link href="/">Back to Canvas</Link>
        </Button>
      </div>
    );
  }

  const totalEarnings = user.totalEarnings || 0;
  const hasStripeAccount = !!user.stripeAccountId;
  const totalPrize = wins.reduce((sum, w) => sum + w.prizeAmount, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Earnings</h1>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Back to Canvas</Link>
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="gap-0 rounded-xl border-border bg-surface py-0">
            <CardContent className="p-5">
              <p className="mb-1 text-sm text-muted">Total Earnings</p>
              <p className="text-2xl font-semibold tabular-nums text-green-400">
                ${(totalEarnings / 100).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card className="gap-0 rounded-xl border-border bg-surface py-0">
            <CardContent className="p-5">
              <p className="mb-1 text-sm text-muted">Contest Wins</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {wins.length}
              </p>
            </CardContent>
          </Card>
          <Card className="gap-0 rounded-xl border-border bg-surface py-0">
            <CardContent className="p-5">
              <p className="mb-1 text-sm text-muted">Prize Money Won</p>
              <p className="text-2xl font-semibold tabular-nums text-amber-400">
                ${(totalPrize / 100).toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stripe Connect */}
        <Card className="mb-8 gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader>
            <CardTitle className="text-lg">Payout Account</CardTitle>
          </CardHeader>
          <CardContent>
            {hasStripeAccount ? (
              <div className="flex items-center gap-3">
                <Badge className="bg-green-500/20 text-green-400">Connected</Badge>
                <p className="text-sm text-muted">
                  Your Stripe account is linked. Payouts will be sent directly to your bank account.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Connect a Stripe account to receive contest prize payouts directly to your bank account.
                </p>
                {onboardError && (
                  <p className="text-xs text-red-400">{onboardError}</p>
                )}
                <Button
                  onClick={handleOnboard}
                  disabled={onboarding}
                  className="bg-accent text-white hover:bg-accent/90"
                >
                  {onboarding ? "Setting up..." : "Connect Stripe Account"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contest Wins */}
        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">Contest History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {wins.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-muted">
                No contest wins yet. Enter contests to earn prizes!
              </p>
            ) : (
              <div className="divide-y divide-border">
                {wins.map((win) => (
                  <div key={win.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Badge
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                          win.rank === 1 ? "bg-yellow-500" : win.rank === 2 ? "bg-gray-400" : "bg-amber-700"
                        }`}
                      >
                        #{win.rank}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Contest #{win.contestId}
                        </p>
                        <p className="text-xs text-muted">
                          {win.likes.toLocaleString()} likes &middot; {win.platform}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-green-400">
                      +${(win.prizeAmount / 100).toFixed(2)}
                    </span>
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
