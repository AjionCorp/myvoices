"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getConnection } from "@/lib/spacetimedb/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTopicStore } from "@/stores/topic-store";

const CATEGORIES: { label: string; emoji: string }[] = [
  { label: "Entertainment", emoji: "🎬" },
  { label: "Music", emoji: "🎵" },
  { label: "Sports", emoji: "⚽" },
  { label: "Gaming", emoji: "🎮" },
  { label: "Comedy", emoji: "😂" },
  { label: "Education", emoji: "📚" },
  { label: "News", emoji: "📰" },
  { label: "Food", emoji: "🍕" },
  { label: "Travel", emoji: "✈️" },
  { label: "Fashion", emoji: "👗" },
  { label: "Technology", emoji: "💻" },
  { label: "Science", emoji: "🔬" },
  { label: "Art", emoji: "🎨" },
  { label: "Animals", emoji: "🐾" },
  { label: "Other", emoji: "✨" },
];

const GRADIENTS = [
  "from-violet-700 to-indigo-950",
  "from-rose-600 to-pink-950",
  "from-amber-500 to-orange-950",
  "from-emerald-600 to-teal-950",
  "from-sky-500 to-blue-950",
  "from-fuchsia-600 to-purple-950",
  "from-red-600 to-rose-950",
  "from-cyan-500 to-sky-950",
];

function pickGradient(seed: string): string {
  let h = 0;
  for (const c of seed) h = Math.imul(31, h) + c.charCodeAt(0);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function PreviewCard({ title, category }: { title: string; category: string }) {
  const gradient = pickGradient(title || "default");
  const cat = CATEGORIES.find((c) => c.label === category);
  const displayTitle = title.trim() || "Your topic title";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 w-48">
      <div className={`relative aspect-4/3 w-full bg-linear-to-br ${gradient} overflow-hidden`}>
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <span className="select-none text-center text-2xl font-black uppercase leading-none tracking-tight text-white/15">
            {displayTitle}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/30 to-transparent px-3 pb-2 pt-5">
          <span className="text-[11px] font-semibold text-white/80">0 videos</span>
        </div>
      </div>
      <div className="bg-surface px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-foreground">{displayTitle}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="rounded-full bg-surface-light px-1.5 py-0.5 text-[10px]">
            {cat?.emoji} {category}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CreateTopicForm() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Entertainment");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slug = slugFromTitle(title);
  const canSubmit = title.trim().length > 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      login();
      return;
    }

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    const conn = getConnection();
    if (!conn) {
      setError("Not connected to server. Please wait and try again.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      conn.reducers.createTopic({
        title: title.trim(),
        description: description.trim(),
        category,
      });

      await new Promise((r) => setTimeout(r, 800));

      const topicStore = useTopicStore.getState();
      const newTopic =
        topicStore.getTopicBySlug(slug) ||
        [...topicStore.topics.values()].find((t) => t.title === title.trim());

      if (newTopic) {
        router.push(`/t/${newTopic.slug}`);
      } else {
        router.push("/");
      }
    } catch {
      setError("Failed to create topic. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-8">
        {/* Fields */}
        <div className="flex-1 space-y-6">
          {/* Title */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
              Title <span className="text-accent normal-case tracking-normal font-normal">required</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(null); }}
                placeholder="e.g. Best MrBeast Videos"
                maxLength={80}
                className="w-full rounded-xl border border-border bg-surface-light px-4 py-3 text-sm text-foreground placeholder-muted/50 outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent/20"
                disabled={isSubmitting}
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted tabular-nums">
                {title.length}/80
              </span>
            </div>
            {slug && (
              <p className="mt-1.5 text-xs text-muted">
                myvoice.app/t/<span className="text-accent/80">{slug}</span>
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
              Description <span className="normal-case tracking-normal font-normal">optional</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of videos belong here?"
              maxLength={300}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-surface-light px-4 py-3 text-sm text-foreground placeholder-muted/50 outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent/20"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-right text-xs text-muted tabular-nums">{description.length}/300</p>
          </div>

          {/* Category chips */}
          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const active = category === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    disabled={isSubmitting}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? "bg-accent text-white shadow-sm shadow-accent/30"
                        : "bg-surface-light text-muted hover:bg-surface hover:text-foreground border border-border"
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 11a1 1 0 110-2 1 1 0 010 2zm1-4H7V5h2v3z"/>
              </svg>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit && isAuthenticated}
            className="w-full rounded-xl bg-accent py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-light hover:shadow-accent/30 disabled:opacity-40 disabled:shadow-none active:scale-[0.98]"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Creating…
              </span>
            ) : isAuthenticated ? (
              "Create Topic"
            ) : (
              "Sign in to Create"
            )}
          </button>
        </div>

        {/* Live preview — hidden on small screens */}
        <div className="hidden sm:flex flex-col items-center gap-3 pt-7">
          <p className="text-xs text-muted">Preview</p>
          <PreviewCard title={title} category={category} />
        </div>
      </div>
    </form>
  );
}
