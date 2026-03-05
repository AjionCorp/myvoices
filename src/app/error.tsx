"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <h1 className="mb-2 text-4xl font-bold text-foreground">Something went wrong</h1>
      <p className="mb-6 text-sm text-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button onClick={reset} className="bg-accent text-white hover:bg-accent/90">
        Try Again
      </Button>
    </div>
  );
}
