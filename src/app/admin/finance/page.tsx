"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Transaction {
  id: string;
  type: "ad_payment" | "prize_payout" | "refund";
  amount: number;
  from: string;
  to: string;
  stripeId: string;
  description: string;
  createdAt: number;
}

export default function FinanceDashboard() {
  const [transactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const totalRevenue = transactions
    .filter((t) => t.type === "ad_payment")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPayouts = transactions
    .filter((t) => t.type === "prize_payout")
    .reduce((sum, t) => sum + t.amount, 0);

  const filtered =
    filter === "all"
      ? transactions
      : transactions.filter((t) => t.type === filter);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Financial Dashboard
      </h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardContent className="p-5">
          <p className="mb-1 text-sm text-muted">Total Revenue</p>
          <p className="text-2xl font-semibold tabular-nums text-green-400">
            ${(totalRevenue / 100).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted">From ad placements</p>
          </CardContent>
        </Card>
        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardContent className="p-5">
          <p className="mb-1 text-sm text-muted">Total Payouts</p>
          <p className="text-2xl font-semibold tabular-nums text-blue-400">
            ${(totalPayouts / 100).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted">To contest winners</p>
          </CardContent>
        </Card>
        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardContent className="p-5">
          <p className="mb-1 text-sm text-muted">Net Balance</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            ${((totalRevenue - totalPayouts) / 100).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted">Revenue - Payouts</p>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 rounded-xl border-border bg-surface py-0">
        <CardHeader className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Transaction History</CardTitle>
          <div className="flex gap-2">
            {["all", "ad_payment", "prize_payout", "refund"].map((f) => (
              <Button
                key={f}
                onClick={() => setFilter(f)}
                variant={filter === f ? "secondary" : "ghost"}
                size="sm"
                className="text-xs"
              >
                {f === "all"
                  ? "All"
                  : f
                      .split("_")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
              </Button>
            ))}
          </div>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted">
                  Description
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted">
                  Stripe ID
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted">
                    No transactions yet. Revenue from ads and payouts will appear here.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-border last:border-none hover:bg-surface-light"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted">
                      {new Date(tx.createdAt / 1000).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          tx.type === "ad_payment"
                            ? "bg-green-500/20 text-green-400"
                            : tx.type === "prize_payout"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {tx.type
                          .split("_")
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(" ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {tx.description}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-medium tabular-nums ${
                        tx.type === "ad_payment"
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {tx.type === "ad_payment" ? "+" : "-"}$
                      {(tx.amount / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {tx.stripeId}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
