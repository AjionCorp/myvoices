"use client";

import { useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useAuth, useSignUp } from "@/components/auth/AuthProvider";

export function ExploreLoginModal() {
  const { showLoginForExploreModal, setShowLoginForExploreModal } = useCanvasStore();
  const { login, isAuthenticated } = useAuth();
  const signUp = useSignUp();

  // Auto-close once the user finishes signing in via Clerk's modal
  useEffect(() => {
    if (isAuthenticated && showLoginForExploreModal) {
      setShowLoginForExploreModal(false);
    }
  }, [isAuthenticated, showLoginForExploreModal, setShowLoginForExploreModal]);

  if (!showLoginForExploreModal) return null;

  const dismiss = () => setShowLoginForExploreModal(false);

  return (
    <div className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface shadow-2xl">

        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 text-muted transition-colors hover:text-foreground"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        {/* Header */}
        <div className="px-6 pb-4 pt-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Explore the full canvas</h2>
          <p className="mt-1.5 text-sm text-muted">
            Create a free account to pan anywhere, claim blocks, like videos, and leave comments.
          </p>
        </div>

        {/* Divider */}
        <div className="mx-6 border-t border-border" />

        {/* Perks */}
        <ul className="mx-6 my-4 space-y-2">
          {[
            "Pan and explore the entire 1M-block grid",
            "Claim a block and share your YouTube or TikTok",
            "Like, dislike, and comment on videos",
          ].map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm text-muted">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-accent" stroke="currentColor" strokeWidth="2">
                <path d="M3 8l3.5 3.5L13 4" />
              </svg>
              {perk}
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="space-y-2 px-6 pb-6">
          <button
            onClick={login}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-light"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            Sign in
          </button>

          <button
            onClick={signUp}
            className="w-full rounded-lg border border-border py-2.5 text-sm font-medium text-muted transition-colors hover:border-foreground hover:text-foreground"
          >
            Create a free account
          </button>

          <button
            onClick={dismiss}
            className="w-full pt-1 text-xs text-muted/60 transition-colors hover:text-muted"
          >
            Continue browsing without an account
          </button>
        </div>
      </div>
    </div>
  );
}
