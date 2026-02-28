"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

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
        <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
          Payment successful! The ad placement is being processed.
        </div>
      )}

      {canceled && (
        <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-400">
          Payment was canceled. No changes were made.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Place New Ad
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Block IDs (comma-separated)
              </label>
              <input
                type="text"
                value={form.blockIds}
                onChange={(e) =>
                  setForm({ ...form, blockIds: e.target.value })
                }
                placeholder="500500, 500501, 500502"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none focus:border-accent"
              />
              <p className="mt-1 text-xs text-muted">
                Select blocks on the canvas or enter IDs manually
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Ad Image URL
              </label>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) =>
                  setForm({ ...form, imageUrl: e.target.value })
                }
                placeholder="https://example.com/ad-image.jpg"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Ad Link URL
              </label>
              <input
                type="url"
                value={form.linkUrl}
                onChange={(e) =>
                  setForm({ ...form, linkUrl: e.target.value })
                }
                placeholder="https://example.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Duration (days)
              </label>
              <input
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
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Billing Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                placeholder="billing@company.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted outline-none focus:border-accent"
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
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-light disabled:opacity-50"
              >
                {isSubmitting ? "Processing..." : "Pay & Place Ad"}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Active Ads
          </h2>
          <p className="py-12 text-center text-sm text-muted">
            No active ads. Place your first ad to get started.
          </p>
        </div>
      </div>
    </div>
  );
}
