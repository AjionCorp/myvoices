"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getConnection } from "@/lib/spacetimedb/client";
import { CheckCircle } from "lucide-react";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetIdentity: string;
  targetName: string;
}

export function ReportDialog({
  open,
  onOpenChange,
  targetIdentity,
  targetName,
}: ReportDialogProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!reason) {
      setError("Please select a reason");
      return;
    }

    const conn = getConnection();
    if (!conn) return;

    setSubmitting(true);
    setError(null);

    try {
      conn.reducers.reportUser({
        targetIdentity,
        reason,
        description: description.trim(),
      });
      setSubmitted(true);
      setTimeout(() => {
        onOpenChange(false);
        // Reset state after close animation
        setTimeout(() => {
          setSubmitted(false);
          setReason("");
          setDescription("");
        }, 200);
      }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setReason("");
      setDescription("");
      setError(null);
      setSubmitted(false);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm border-white/10 bg-[#0e0e0e] text-white">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle size={40} className="text-green-400" />
            <p className="text-sm font-medium text-white/80">Report submitted</p>
            <p className="text-xs text-white/40">Thank you. We&apos;ll review this shortly.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report @{targetName}</DialogTitle>
              <DialogDescription className="text-white/45">
                Why are you reporting this user?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Reason selection */}
              <div className="space-y-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => { setReason(r.value); setError(null); }}
                    className={`flex w-full items-center rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      reason === r.value
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-white/10 text-white/60 hover:border-white/20 hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`mr-3 h-4 w-4 shrink-0 rounded-full border-2 ${
                        reason === r.value
                          ? "border-accent bg-accent"
                          : "border-white/30"
                      }`}
                    >
                      {reason === r.value && (
                        <div className="m-0.5 h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs text-white/60">
                  Additional details (optional)
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                  placeholder="Provide more context..."
                  className="h-20 resize-none border-white/10 bg-white/5 text-sm text-white placeholder:text-white/25"
                />
                <p className="text-right text-[10px] text-white/30">
                  {description.length}/500
                </p>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                className="text-white/50 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !reason}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
