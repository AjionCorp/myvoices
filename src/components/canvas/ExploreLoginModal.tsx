"use client";

import { useEffect } from "react";
import { Compass, X } from "lucide-react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useAuth, useSignUp } from "@/components/auth/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    <Dialog open={showLoginForExploreModal} onOpenChange={setShowLoginForExploreModal}>
      <DialogContent className="max-w-sm border-border bg-surface p-0" showCloseButton={false}>
        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          className="absolute right-2 top-2"
        >
          <X />
        </Button>
        <DialogHeader className="px-6 pb-4 pt-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent">
            <Compass className="size-5" />
          </div>
          <DialogTitle className="text-center">Explore the full canvas</DialogTitle>
          <DialogDescription className="text-center">
            Create a free account to pan anywhere, claim blocks, like videos, and leave comments.
          </DialogDescription>
        </DialogHeader>
        <Card className="mx-6 my-4 gap-0 border-border bg-background/40 py-3 shadow-none">
          <CardContent className="px-4">
            <ul className="space-y-2">
              {[
                "Pan and explore the entire 1M-block grid",
                "Claim a block and share your YouTube or TikTok",
                "Like, dislike, and comment on videos",
              ].map((perk) => (
                <li key={perk} className="text-sm text-muted">
                  {perk}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="space-y-2 px-6 pb-6">
          <Button onClick={login} className="w-full">Sign in</Button>
          <Button onClick={signUp} variant="outline" className="w-full">Create a free account</Button>
          <Button onClick={dismiss} variant="ghost" className="w-full text-xs text-muted">
            Continue browsing without an account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
