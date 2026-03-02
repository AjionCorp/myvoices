"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getConnection } from "@/lib/spacetimedb/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTopicStore } from "@/stores/topic-store";
import { extractYouTubeId, getYouTubeThumbnail } from "@/lib/utils/youtube";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = [
  "Entertainment",
  "Music",
  "Sports",
  "Gaming",
  "Comedy",
  "Education",
  "News",
  "Food",
  "Travel",
  "Fashion",
  "Technology",
  "Science",
  "Art",
  "Animals",
  "Other",
] as const;

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

interface VideoMeta {
  videoId: string;
  viewCount: string;
  likeCount: string;
  title: string;
  ownerChannelName: string;
  isShortsEligible: boolean;
}

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

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

function PreviewCard({
  title,
  category,
  youtubeVideoId,
}: {
  title: string;
  category: string;
  youtubeVideoId: string | null;
}) {
  const gradient = pickGradient(title || "default");
  const displayTitle = title.trim() || "Your topic title";
  const thumbnailUrl = youtubeVideoId ? getYouTubeThumbnail(youtubeVideoId) : null;

  return (
    <div className="w-full max-w-[260px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
      <div className={`relative aspect-4/3 w-full overflow-hidden bg-linear-to-br ${gradient}`}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={`${displayTitle} starter video thumbnail`} className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <span className="select-none text-center text-2xl font-black uppercase leading-none tracking-tight text-white/15">
              {displayTitle}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/30 to-transparent px-3 pb-2 pt-5">
          <span className="text-[11px] font-semibold text-white/80">{thumbnailUrl ? "1 video" : "0 videos"}</span>
        </div>
      </div>
      <div className="bg-surface px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-foreground">{displayTitle}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="rounded-full bg-surface-light px-2 py-0.5 text-[10px]">{category}</span>
        </div>
      </div>
    </div>
  );
}

function TitleProgress({ length, max }: { length: number; max: number }) {
  const pct = Math.min(100, (length / max) * 100);
  const color = length >= 75 ? "bg-red-500" : length >= 60 ? "bg-amber-400" : "bg-accent";

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full transition-all duration-150 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={`shrink-0 text-[11px] tabular-nums transition-colors ${
          length >= 75 ? "text-red-400" : length >= 60 ? "text-amber-400" : "text-muted"
        }`}
      >
        {length}/{max}
      </span>
    </div>
  );
}

export function CreateTopicForm() {
  const router = useRouter();
  const { user, isAuthenticated, login } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [categoryInput, setCategoryInput] = useState("Entertainment");
  const [starterVideoMeta, setStarterVideoMeta] = useState<VideoMeta | null>(null);
  const [isVideoMetaLoading, setIsVideoMetaLoading] = useState(false);
  const [videoMetaError, setVideoMetaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slug = slugFromTitle(title);
  const normalizedCategory =
    CATEGORIES.find((value) => value.toLowerCase() === categoryInput.trim().toLowerCase()) ?? null;
  const categoryMatches = CATEGORIES.filter((value) =>
    value.toLowerCase().includes(categoryInput.trim().toLowerCase())
  );
  const starterVideoId = starterVideoMeta?.videoId ?? extractYouTubeId(youtubeUrl.trim());
  const canSubmit =
    title.trim().length > 0 &&
    !!starterVideoMeta &&
    !!normalizedCategory &&
    !isVideoMetaLoading &&
    !isSubmitting;
  const ctaLabel = isSubmitting ? "Creating..." : isAuthenticated ? "Create Topic" : "Sign in to Create";

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleYoutubeUrlChange = (value: string) => {
    setYoutubeUrl(value);
    setError(null);
    setVideoMetaError(null);
    setStarterVideoMeta(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (!trimmed) {
      setIsVideoMetaLoading(false);
      return;
    }

    setIsVideoMetaLoading(true);

    debounceRef.current = setTimeout(async () => {
      const videoId = VIDEO_ID_RE.test(trimmed) ? trimmed : extractYouTubeId(trimmed);

      if (!videoId) {
        setVideoMetaError("Enter a valid YouTube URL or video ID.");
        setIsVideoMetaLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/v1/video-meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setVideoMetaError(data.error || `Failed to load video metadata (${res.status}).`);
          setStarterVideoMeta(null);
        } else {
          const data: VideoMeta = await res.json();
          setStarterVideoMeta(data);
          setVideoMetaError(null);
        }
      } catch {
        setVideoMetaError("Network error while loading video metadata.");
        setStarterVideoMeta(null);
      } finally {
        setIsVideoMetaLoading(false);
      }
    }, 500);
  };

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

    if (!starterVideoMeta || !starterVideoId) {
      setError("A valid starter YouTube video is required.");
      return;
    }

    if (!normalizedCategory) {
      setError("Please pick a category from the list.");
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
        category: normalizedCategory,
      });

      await new Promise((r) => setTimeout(r, 800));

      const topicStore = useTopicStore.getState();
      const newTopic =
        topicStore.getTopicBySlug(slug) ||
        [...topicStore.topics.values()].find((t) => t.title === title.trim());

      if (newTopic) {
        const ownerName = starterVideoMeta.ownerChannelName || user?.username || user?.displayName || "Anonymous";
        const platform = starterVideoMeta.isShortsEligible ? "youtube_short" : "youtube";
        conn.reducers.claimBlockInTopic({
          topicId: BigInt(newTopic.id),
          videoId: starterVideoId,
          platform,
          ownerName,
          ytViews: BigInt(starterVideoMeta.viewCount || "0"),
          ytLikes: BigInt(starterVideoMeta.likeCount || "0"),
        });
      }

      router.push(newTopic ? `/t/${newTopic.slug}` : "/");
    } catch {
      setError("Failed to create topic. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="mx-auto w-full max-w-3xl space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <Card className="gap-0 border-border bg-surface py-0">
            <CardContent className="p-4 sm:p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Topic details</p>

            <div className="space-y-5">
              <div>
                <label htmlFor="topic-title" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Title <span className="font-normal normal-case tracking-normal text-accent">required</span>
                </label>
                <Input
                  id="topic-title"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Best MrBeast Videos"
                  maxLength={80}
                  className="h-11 rounded-xl border-border bg-surface-light px-4 placeholder-muted/50"
                  disabled={isSubmitting}
                  autoFocus
                />
                <TitleProgress length={title.length} max={80} />

                {slug && (
                  <Badge variant="outline" className="mt-2 inline-flex items-center overflow-hidden rounded-full bg-surface-light px-3 py-1 text-xs">
                    <span className="text-muted">myvoice.app/t/</span>
                    <span className="font-semibold text-accent">{slug}</span>
                  </Badge>
                )}
              </div>

              <div>
                <label
                  htmlFor="topic-description"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  Description <span className="font-normal normal-case tracking-normal">optional</span>
                </label>
                <Textarea
                  id="topic-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What kind of videos belong here?"
                  maxLength={300}
                  rows={4}
                  className="rounded-xl border-border bg-surface-light px-4 py-3 placeholder-muted/50"
                  disabled={isSubmitting}
                />
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-muted">Short, clear prompts attract better submissions.</p>
                  <p className="text-xs text-muted tabular-nums">{description.length}/300</p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="topic-youtube-url"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  Starter video URL <span className="font-normal normal-case tracking-normal text-accent">required</span>
                </label>
                <Input
                  id="topic-youtube-url"
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or dQw4w9WgXcQ"
                  className="h-11 rounded-xl border-border bg-surface-light px-4 placeholder-muted/50"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-muted">This video is pre-populated at x=0, y=0 for the new topic.</p>
                {isVideoMetaLoading && <p className="mt-1 text-xs text-muted">Loading video metadata...</p>}
                {videoMetaError && <p className="mt-1 text-xs text-red-400">{videoMetaError}</p>}
                {starterVideoMeta && !isVideoMetaLoading && (
                  <p className="mt-1 text-xs text-emerald-400">
                    Ready: {starterVideoMeta.title || starterVideoMeta.videoId}
                  </p>
                )}
              </div>
            </div>
            </CardContent>
          </Card>

          <Card className="gap-0 border-border bg-surface py-0">
            <CardContent className="p-4 sm:p-5">
            <label
              htmlFor="topic-category"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Category
            </label>
            <Input
              id="topic-category"
              list="topic-category-options"
              value={categoryInput}
              onChange={(e) => {
                setCategoryInput(e.target.value);
                setError(null);
              }}
              placeholder="Type to search category..."
              className="h-11 w-full rounded-xl border-border bg-surface-light px-4"
              disabled={isSubmitting}
            />
            <datalist id="topic-category-options">
              {categoryMatches.map((label) => (
                <option key={label} value={label} />
              ))}
            </datalist>
            <p className="mt-2 text-xs text-muted">Type 1+ characters to filter categories, then pick one.</p>
            {!normalizedCategory && (
              <p className="mt-1 text-xs text-amber-400">Choose a category from the suggested options.</p>
            )}
            </CardContent>
          </Card>

          {error && (
            <p className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 11a1 1 0 110-2 1 1 0 010 2zm1-4H7V5h2v3z" />
              </svg>
              {error}
            </p>
          )}

          <div className="hidden lg:block">
            <Button
              type="submit"
              disabled={!canSubmit && isAuthenticated}
              className="h-11 w-full rounded-xl"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  {ctaLabel}
                </span>
              ) : (
                ctaLabel
              )}
            </Button>
            {canSubmit && !isSubmitting && (
              <p className="mt-2 text-center text-xs text-muted">
                You will be taken straight to your new topic.{" "}
                <kbd className="rounded bg-surface-light px-1 py-0.5 font-mono text-[10px]">Ctrl/Cmd + Enter</kbd>
              </p>
            )}
          </div>
        </div>

        <aside className="order-first space-y-3 lg:order-0 lg:sticky lg:top-20">
          <p className="text-xs text-muted">Preview</p>
          <PreviewCard
            title={title}
            category={normalizedCategory ?? (categoryInput || "Entertainment")}
            youtubeVideoId={starterVideoId}
          />
          <Card className="gap-0 rounded-xl border-border bg-surface py-0 shadow-none">
            <CardContent className="px-3 py-2 text-xs text-muted">
            Tip: concrete titles perform best (e.g. &quot;Best parkour clips 2026&quot;).
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/90 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:px-8 lg:hidden">
        <div className="mx-auto w-full max-w-3xl">
          <Button
            type="submit"
            disabled={!canSubmit && isAuthenticated}
            className="h-11 w-full rounded-xl"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                {ctaLabel}
              </span>
            ) : (
              ctaLabel
            )}
          </Button>
          {canSubmit && !isSubmitting && (
            <p className="mt-1.5 text-center text-xs text-muted">You will be taken straight to your new topic.</p>
          )}
        </div>
      </div>
    </form>
  );
}
