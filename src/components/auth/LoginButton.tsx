"use client";

import { useAuth } from "./AuthProvider";

export function LoginButton() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="h-10 w-24 animate-pulse rounded-lg bg-surface-light" />
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {user.displayName}
          </span>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-foreground hover:text-foreground"
        >
          Sign Out
        </button>
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
