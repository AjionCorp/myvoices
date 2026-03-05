import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <h1 className="mb-2 text-6xl font-bold text-foreground">404</h1>
      <p className="mb-6 text-lg text-muted">
        This page doesn&apos;t exist.
      </p>
      <Button asChild>
        <Link href="/">Back to Canvas</Link>
      </Button>
    </div>
  );
}
