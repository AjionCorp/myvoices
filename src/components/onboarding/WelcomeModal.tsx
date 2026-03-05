"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { Compass, Play, Upload } from "lucide-react";

const STORAGE_KEY = "myvoice_onboarded";

const STEPS = [
  {
    icon: Compass,
    title: "Explore Topics",
    description:
      "Browse the canvas to discover topics created by the community. Each cluster represents a category — click any topic tile to dive in.",
  },
  {
    icon: Play,
    title: "Watch & Vote",
    description:
      "Inside a topic, videos are arranged in a spiral. The most-liked videos move toward the center. Like or dislike videos to influence their position.",
  },
  {
    icon: Upload,
    title: "Submit Videos",
    description:
      "Got a great video? Paste a YouTube, TikTok, or BiliBili link to claim a spot on the spiral. Compete in contests to win prizes!",
  },
];

export function WelcomeModal() {
  const { isAuthenticated } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      // Small delay so the page loads first
      const t = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated]);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const current = STEPS[step];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border-border bg-surface p-0">
        <DialogTitle className="sr-only">Welcome to myVoice</DialogTitle>

        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-accent via-accent-light to-primary" />

        <div className="px-6 pt-6 pb-5">
          {/* Step indicator */}
          <div className="mb-5 flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-accent" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <current.icon className="h-7 w-7 text-accent" />
          </div>

          {/* Content */}
          <h2 className="mb-2 text-center text-lg font-bold text-foreground">
            {step === 0 ? "Welcome to myVoice!" : current.title}
          </h2>
          <p className="mb-6 text-center text-sm leading-relaxed text-muted">
            {current.description}
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handleClose}
              className="flex-1 text-muted hover:text-foreground"
            >
              Skip
            </Button>
            <Button onClick={handleNext} className="flex-1">
              {step < STEPS.length - 1 ? "Next" : "Get Started"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
