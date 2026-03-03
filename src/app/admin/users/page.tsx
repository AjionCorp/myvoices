"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClearableInput } from "@/components/ui/clearable-input";

interface UserEntry {
  identity: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  totalEarnings: number;
  blocksClaimed: number;
  totalLikes: number;
}

export default function UsersManagement() {
  const [search, setSearch] = useState("");
  const [users] = useState<UserEntry[]>([]);

  const filtered = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.identity.includes(search)
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        User Management
      </h1>

      <div className="mb-6">
        <ClearableInput
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder="Search users by name, email, or identity..."
          className="w-full max-w-md bg-surface"
        />
      </div>

      <Card className="gap-0 rounded-xl border-border bg-surface py-0">
        <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted">
                  Email
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted">
                  Blocks
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted">
                  Likes
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted">
                  Earnings
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
                        <span className="text-sm font-medium text-foreground">
                          {user.displayName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {user.email || "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                      {user.blocksClaimed}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                      {user.totalLikes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                      ${(user.totalEarnings / 100).toFixed(2)}
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
                      <Button variant="ghost" size="sm" className="text-xs text-muted hover:text-foreground">
                        Manage
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
