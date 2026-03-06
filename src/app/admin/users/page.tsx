"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClearableInput } from "@/components/ui/clearable-input";
import { getConnection } from "@/lib/spacetimedb/client";

interface UserEntry {
  identity: string;
  username: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  totalEarnings: number;
  credits: number;
  createdAt: number;
}

export default function UsersManagement() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [sortBy, setSortBy] = useState<"createdAt" | "totalEarnings" | "displayName">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const loadUsers = useCallback(() => {
    const conn = getConnection();
    if (!conn) return;
    const list: UserEntry[] = [];
    for (const row of conn.db.user_profile.iter()) {
      list.push({
        identity: row.identity,
        username: row.username,
        displayName: row.displayName,
        email: row.email,
        isAdmin: row.isAdmin,
        totalEarnings: Number(row.totalEarnings),
        credits: Number(row.credits),
        createdAt: Number(row.createdAt),
      });
    }
    setUsers(list);
  }, []);

  useEffect(() => {
    const conn = getConnection();
    const timer = setTimeout(() => loadUsers(), 0);
    if (!conn) {
      return () => clearTimeout(timer);
    }
    const handleInsert = () => loadUsers();
    const handleUpdate = () => loadUsers();
    const handleDelete = () => loadUsers();
    conn.db.user_profile.onInsert(handleInsert);
    conn.db.user_profile.onUpdate(handleUpdate);
    conn.db.user_profile.onDelete(handleDelete);
    return () => {
      clearTimeout(timer);
      conn.db.user_profile.removeOnInsert(handleInsert);
      conn.db.user_profile.removeOnUpdate(handleUpdate);
      conn.db.user_profile.removeOnDelete(handleDelete);
    };
  }, [loadUsers]);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const filtered = users
    .filter(
      (u) =>
        u.displayName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.identity.includes(search)
    )
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "displayName") return dir * a.displayName.localeCompare(b.displayName);
      return dir * (a[sortBy] - b[sortBy]);
    });

  const handleToggleAdmin = (identity: string, currentlyAdmin: boolean) => {
    const conn = getConnection();
    if (!conn) return;
    conn.reducers.setAdmin({ targetIdentity: identity, isAdmin: !currentlyAdmin });
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        User Management
      </h1>

      <div className="mb-4 flex items-center justify-between">
        <ClearableInput
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder="Search users by name, email, username, or identity..."
          className="w-full max-w-md bg-surface"
        />
        <span className="text-sm text-muted">
          {filtered.length} of {users.length} users
        </span>
      </div>

      <Card className="gap-0 rounded-xl border-border bg-surface py-0">
        <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase text-muted hover:text-foreground"
                  onClick={() => handleSort("displayName")}
                >
                  User {sortBy === "displayName" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted">
                  Email
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-medium uppercase text-muted hover:text-foreground"
                  onClick={() => handleSort("createdAt")}
                >
                  Joined {sortBy === "createdAt" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-medium uppercase text-muted hover:text-foreground"
                  onClick={() => handleSort("totalEarnings")}
                >
                  Earnings {sortBy === "totalEarnings" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted">
                  Credits
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted">
                  Role
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                    {users.length === 0
                      ? "No users registered yet."
                      : "No users match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr
                    key={user.identity}
                    className="border-b border-border last:border-none hover:bg-surface-light"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">
                            {user.displayName}
                          </span>
                          <p className="text-xs text-muted">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {user.email || "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-muted">
                      {new Date(user.createdAt / 1000).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                      ${(user.totalEarnings / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                      {user.credits.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          user.isAdmin
                            ? "bg-accent/20 text-accent-light"
                            : "bg-surface-light text-muted"
                        }`}
                      >
                        {user.isAdmin ? "Admin" : "User"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted hover:text-foreground"
                        onClick={() => handleToggleAdmin(user.identity, user.isAdmin)}
                      >
                        {user.isAdmin ? "Remove Admin" : "Make Admin"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
