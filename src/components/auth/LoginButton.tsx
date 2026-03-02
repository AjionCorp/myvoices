"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function LoginButton() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (isLoading) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-surface-light" />;
  }

  if (isAuthenticated && user) {
    const initials = (user.username || user.displayName)
      .charAt(0)
      .toUpperCase();

    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80"
          aria-haspopup="true"
          aria-expanded={open}
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-bold text-white ring-2 ring-border">
            {user.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt={user.username || user.displayName}
                fill
                sizes="36px"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              initials
            )}
          </div>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {user.username || user.displayName}
          </span>
          {/* chevron */}
          <svg
            className={`hidden h-3.5 w-3.5 text-muted transition-transform sm:block ${open ? "rotate-180" : ""}`}
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
            <div className="border-b border-border px-4 py-2.5">
              <p className="text-xs text-muted">Signed in as</p>
              <p className="truncate text-sm font-medium text-foreground">
                {user.username || user.displayName}
              </p>
            </div>
            <nav className="py-1">
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface"
              >
                <svg className="h-4 w-4 text-muted" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6.75 8a6.75 6.75 0 0 1 13.5 0H3.25Z" />
                </svg>
                Account
              </Link>
              <button
                onClick={() => { setOpen(false); logout(); }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-surface"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Zm13.03 4.97-1.5-1.5a.75.75 0 0 0-1.06 1.06l.22.22H8.5a.75.75 0 0 0 0 1.5h5.19l-.22.22a.75.75 0 1 0 1.06 1.06l1.5-1.5a.75.75 0 0 0 0-1.06Z" clipRule="evenodd" />
                </svg>
                Sign out
              </button>
            </nav>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light"
    >
      Sign In
    </button>
  );
}
