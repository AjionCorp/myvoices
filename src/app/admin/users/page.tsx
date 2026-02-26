"use client";

import { useState } from "react";

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
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users by name, email, or identity..."
          className="w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none focus:border-accent"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface">
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
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          user.isAdmin
                            ? "bg-accent/20 text-accent-light"
                            : "bg-surface-light text-muted"
                        }`}
                      >
                        {user.isAdmin ? "Admin" : "User"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-xs text-muted transition-colors hover:text-foreground">
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
