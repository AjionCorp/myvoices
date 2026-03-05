"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getConnection, subscribeToReports } from "@/lib/spacetimedb/client";

interface Report {
  id: number;
  reporterIdentity: string;
  reportedIdentity: string;
  reason: string;
  description: string;
  status: string;
  reviewedBy: string;
  createdAt: number;
  reviewedAt: number;
  reporterName: string;
  reportedName: string;
}

export default function ReportsManagement() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<"pending" | "reviewed" | "all">("pending");

  const resolveDisplayName = useCallback((identity: string): string => {
    const conn = getConnection();
    if (!conn) return identity.slice(0, 12) + "...";
    const profile = conn.db.user_profile.identity.find(identity);
    return profile?.displayName || identity.slice(0, 12) + "...";
  }, []);

  const loadReports = useCallback(() => {
    const conn = getConnection();
    if (!conn) return;
    const list: Report[] = [];
    for (const row of conn.db.user_report.iter()) {
      list.push({
        id: Number(row.id),
        reporterIdentity: row.reporterIdentity,
        reportedIdentity: row.reportedIdentity,
        reason: row.reason,
        description: row.description,
        status: row.status,
        reviewedBy: row.reviewedBy,
        createdAt: Number(row.createdAt),
        reviewedAt: Number(row.reviewedAt),
        reporterName: resolveDisplayName(row.reporterIdentity),
        reportedName: resolveDisplayName(row.reportedIdentity),
      });
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    setReports(list);
  }, [resolveDisplayName]);

  useEffect(() => {
    // Subscribe to reports (admin-only, not in global subscription)
    subscribeToReports();
    // Small delay to allow subscription to apply before loading
    const timer = setTimeout(() => loadReports(), 500);
    const conn = getConnection();
    if (!conn) return () => clearTimeout(timer);

    const handleInsert = () => loadReports();
    const handleUpdate = () => loadReports();
    const handleDelete = () => loadReports();

    conn.db.user_report.onInsert(handleInsert);
    conn.db.user_report.onUpdate(handleUpdate);
    conn.db.user_report.onDelete(handleDelete);

    return () => {
      clearTimeout(timer);
      conn.db.user_report.removeOnInsert(handleInsert);
      conn.db.user_report.removeOnUpdate(handleUpdate);
      conn.db.user_report.removeOnDelete(handleDelete);
    };
  }, [loadReports]);

  const handleReview = (reportId: number, action: string) => {
    const conn = getConnection();
    if (!conn) return;
    conn.reducers.reviewReport({ reportId: BigInt(reportId), action });
  };

  const filtered = filter === "all"
    ? reports
    : filter === "pending"
      ? reports.filter((r) => r.status === "pending")
      : reports.filter((r) => r.status !== "pending");

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  const statusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "reviewed": return "bg-green-500/20 text-green-400";
      case "dismissed": return "bg-gray-500/20 text-gray-400";
      default: return "bg-surface-light text-muted";
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Report Review Queue
        {pendingCount > 0 && (
          <Badge className="ml-3 bg-yellow-500/20 text-sm text-yellow-400">
            {pendingCount} pending
          </Badge>
        )}
      </h1>

      <div className="mb-4 flex gap-2">
        {(["pending", "reviewed", "all"] as const).map((f) => (
          <Button
            key={f}
            onClick={() => setFilter(f)}
            variant={filter === f ? "secondary" : "ghost"}
            size="sm"
            className="text-xs capitalize"
          >
            {f} {f === "pending" && pendingCount > 0 ? `(${pendingCount})` : ""}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardContent className="p-0">
            <p className="px-4 py-12 text-center text-sm text-muted">
              {reports.length === 0
                ? "No reports have been submitted yet."
                : "No reports match this filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Card key={report.id} className="gap-0 rounded-xl border-border bg-surface py-0">
              <CardHeader className="border-b border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusColor(report.status)}`}>
                      {report.status}
                    </Badge>
                    <CardTitle className="text-sm font-medium">
                      Report #{report.id}
                    </CardTitle>
                    <span className="text-xs text-muted">
                      {new Date(report.createdAt / 1000).toLocaleString()}
                    </span>
                  </div>
                  {report.status !== "pending" && report.reviewedAt > 0 && (
                    <span className="text-xs text-muted">
                      Reviewed {new Date(report.reviewedAt / 1000).toLocaleString()}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="mb-3 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted">Reporter</p>
                    <p className="text-sm font-medium text-foreground">{report.reporterName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Reported User</p>
                    <p className="text-sm font-medium text-foreground">{report.reportedName}</p>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-muted">Reason</p>
                  <p className="text-sm font-medium capitalize text-foreground">{report.reason}</p>
                </div>

                {report.description && (
                  <div className="mb-3">
                    <p className="text-xs text-muted">Details</p>
                    <p className="text-sm text-foreground">{report.description}</p>
                  </div>
                )}

                {report.status === "pending" && (
                  <div className="mt-4 flex gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted hover:text-foreground"
                      onClick={() => handleReview(report.id, "dismissed")}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs"
                      onClick={() => handleReview(report.id, "reviewed")}
                    >
                      Mark as Reviewed
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
