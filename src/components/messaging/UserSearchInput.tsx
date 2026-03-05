"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { getConnection } from "@/lib/spacetimedb/client";
import { useAuthStore } from "@/stores/auth-store";

interface UserResult {
  identity: string;
  username: string;
  displayName: string;
}

interface Props {
  onSelect: (user: UserResult) => void;
  placeholder?: string;
}

export function UserSearchInput({ onSelect, placeholder = "Search people" }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const myIdentity = useAuthStore((s) => s.user?.identity);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const conn = getConnection();
    if (!conn) return [];

    const q = query.toLowerCase();
    const matches: UserResult[] = [];

    for (const row of conn.db.user_profile.iter()) {
      if (row.identity === myIdentity) continue;
      const name = (row.displayName || "").toLowerCase();
      const uname = (row.username || "").toLowerCase();
      if (name.includes(q) || uname.includes(q) || row.identity.includes(q)) {
        matches.push({
          identity: row.identity,
          username: row.username || row.identity.slice(0, 8),
          displayName: row.displayName || row.identity.slice(0, 8),
        });
      }
      if (matches.length >= 10) break;
    }

    return matches;
  }, [query, myIdentity]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-accent/5 px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border/40 bg-background shadow-lg">
          {results.map((user) => (
            <button
              key={user.identity}
              onClick={() => {
                onSelect(user);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/10"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                {user.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {user.displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{user.username}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
