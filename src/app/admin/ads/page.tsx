"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface AdForm {
  blockIds: string;
  imageUrl: string;
  linkUrl: string;
  durationDays: number;
  email: string;
}

export default function AdsManagement() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  const [form, setForm] = useState<AdForm>({
    blockIds: "",
    imageUrl: "",
    linkUrl: "",
    durationDays: 30,
    email: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const blockIds = form.blockIds
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      if (blockIds.length === 0) {
        setError("Enter at least one valid block ID");
        return;
      }

      const res = await fetch("/api/v1/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockIds,
          imageUrl: form.imageUrl,
          linkUrl: form.linkUrl,
          durationDays: form.durationDays,
          email: form.email,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create checkout");
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        Ad Management
      </h1>

      {success && (
        <Card className="mb-6 gap-0 rounded-lg border-green-500/30 bg-green-500/10 py-0 text-sm text-green-400">
          <CardContent className="p-4">
          Payment successful! The ad placement is being processed.
          </CardContent>
        </Card>
      )}

      {canceled && (
        <Card className="mb-6 gap-0 rounded-lg border-yellow-500/30 bg-yellow-500/10 py-0 text-sm text-yellow-400">
          <CardContent className="p-4">
          Payment was canceled. No changes were made.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader>
            <CardTitle className="text-lg">Place New Ad</CardTitle>
          </CardHeader>
          <CardContent>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Block IDs (comma-separated)
              </label>
              <Input
                type="text"
                value={form.blockIds}
                onChange={(e) =>
                  setForm({ ...form, blockIds: e.target.value })
                }
                placeholder="500500, 500501, 500502"
                className="bg-background"
              />
              <p className="mt-1 text-xs text-muted">
                Select blocks on the canvas or enter IDs manually
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Ad Image URL
              </label>
              <Input
                type="url"
                value={form.imageUrl}
                onChange={(e) =>
                  setForm({ ...form, imageUrl: e.target.value })
                }
                placeholder="https://example.com/ad-image.jpg"
                className="bg-background"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Ad Link URL
              </label>
              <Input
                type="url"
                value={form.linkUrl}
                onChange={(e) =>
                  setForm({ ...form, linkUrl: e.target.value })
                }
                placeholder="https://example.com"
                className="bg-background"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Duration (days)
              </label>
              <Input
                type="number"
                min={1}
                max={365}
                value={form.durationDays}
                onChange={(e) =>
                  setForm({
                    ...form,
                    durationDays: parseInt(e.target.value, 10) || 30,
                  })
                }
                className="bg-background"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Billing Email
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                placeholder="billing@company.com"
                className="bg-background"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted">
                Cost:{" "}
                <span className="font-semibold text-foreground">
                  $
                  {(
                    (form.blockIds.split(",").filter((s) => s.trim()).length *
                      form.durationDays) /
                    1
                  ).toFixed(2)}
                </span>{" "}
                ({form.blockIds.split(",").filter((s) => s.trim()).length}{" "}
                blocks x {form.durationDays} days)
              </p>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processing..." : "Pay & Place Ad"}
              </Button>
            </div>
          </form>
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-xl border-border bg-surface py-0">
          <CardHeader>
            <CardTitle className="text-lg">Active Ads</CardTitle>
          </CardHeader>
          <CardContent>
          <p className="py-12 text-center text-sm text-muted">
            No active ads. Place your first ad to get started.
          </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
