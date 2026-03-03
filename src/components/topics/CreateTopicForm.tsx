"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getConnection } from "@/lib/spacetimedb/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTopicStore } from "@/stores/topic-store";
import { Platform, CATEGORIES, CATEGORY_GROUPS } from "@/lib/constants";
import { getThumbnailUrl, normalizeThumbnailForStorage } from "@/lib/utils/video-url";
import { resolveVideoMeta, type ResolvedVideoMeta } from "@/lib/utils/video-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ClearableInput } from "@/components/ui/clearable-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";


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

function PreviewCard({
  title,
  category,
  starterVideoId,
  starterPlatform,
  starterThumbnailUrl,
}: {
  title: string;
  category: string;
  starterVideoId: string | null;
  starterPlatform: Platform | null;
  starterThumbnailUrl: string | null;
}) {
  const gradient = pickGradient(title || "default");
  const displayTitle = title.trim() || "Your topic title";
  const thumbnailUrl =
    starterVideoId && starterPlatform
      ? getThumbnailUrl(starterVideoId, starterPlatform, starterThumbnailUrl)
      : null;

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
          <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">{category}</Badge>
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
  const [starterUrl, setStarterUrl] = useState("");
  const [starterMeta, setStarterMeta] = useState<ResolvedVideoMeta | null>(null);
  const [isResolvingStarter, setIsResolvingStarter] = useState(false);
  const [categoryInput, setCategoryInput] = useState("Entertainment");
  const [subcategoryInput, setSubcategoryInput] = useState("");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { topics, taxonomyNodes } = useTopicStore();

  const slug = slugFromTitle(title);
  const activeNodes = useMemo(
    () =>
      [...taxonomyNodes.values()]
        .filter((n) => n.isActive)
        .sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name)),
    [taxonomyNodes]
  );
  const topLevelNodes = useMemo(
    () => activeNodes.filter((n) => n.depth === 0 && n.parentId === null),
    [activeNodes]
  );
  // Always use the CATEGORIES constant as the authoritative list so the
  // category sent to createTopic always passes backend VALID_CATEGORIES
  // validation. Taxonomy nodes are used only for subcategory lookups below.
  const topLevelNames = [...CATEGORIES] as string[];
  const normalizedCategory =
    topLevelNames.find((value) => value.toLowerCase() === categoryInput.trim().toLowerCase()) ?? null;
  const categoryMatches = topLevelNames.filter((value) =>
    value.toLowerCase().includes(categorySearch.trim().toLowerCase())
  );
  const selectedTopLevelNode = normalizedCategory
    ? topLevelNodes.find((node) => node.name.toLowerCase() === normalizedCategory.toLowerCase()) ?? null
    : null;
  const childNodes = selectedTopLevelNode
    ? activeNodes.filter((n) => n.parentId === selectedTopLevelNode.id)
    : [];
  const subcategoryMatches = childNodes.filter((node) =>
    node.name.toLowerCase().includes(subcategorySearch.trim().toLowerCase())
  );
  const selectedSubNode =
    childNodes.find((node) => node.name.toLowerCase() === subcategoryInput.trim().toLowerCase()) ?? null;
  const selectedTaxonomyNodeId = selectedSubNode?.id ?? selectedTopLevelNode?.id ?? null;
  const normalizedNewSubcategory = newSubcategoryName.trim();
  const starterVideoId = starterMeta?.videoId ?? null;
  const starterPlatform = starterMeta?.platform ?? null;
  const starterThumbnailUrl = starterMeta?.thumbnailUrl ?? null;

  const titleLower = title.trim().toLowerCase();
  const titleTaken =
    titleLower.length > 0 &&
    [...topics.values()].some((t) => t.title.toLowerCase() === titleLower);

  const canSubmit =
    title.trim().length > 0 &&
    !titleTaken &&
    !!starterMeta &&
    !!normalizedCategory &&
    !isResolvingStarter &&
    !isSubmitting;
  const ctaLabel = isSubmitting ? "Creating..." : isAuthenticated ? "Create Topic" : "Sign in to Create";

  useEffect(() => {
    const hasCurrent = CATEGORIES.some((name) => name.toLowerCase() === categoryInput.trim().toLowerCase());
    if (!hasCurrent) {
      setCategoryInput(CATEGORIES[0]);
      setSubcategoryInput("");
    }
  }, [categoryInput]);

  useEffect(() => {
    const value = starterUrl.trim();
    if (!value) {
      setStarterMeta(null);
      setIsResolvingStarter(false);
      return;
    }

    let cancelled = false;
    setIsResolvingStarter(true);
    const timer = setTimeout(async () => {
      try {
        const meta = await resolveVideoMeta(value);
        if (!cancelled) setStarterMeta(meta);
      } catch {
        if (!cancelled) setStarterMeta(null);
      } finally {
        if (!cancelled) setIsResolvingStarter(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [starterUrl]);

  const handleStarterUrlChange = (value: string) => {
    setStarterUrl(value);
    setError(null);
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

    if (!starterMeta || !starterVideoId) {
      setError("A valid starter URL is required (YouTube, TikTok, or BiliBili).");
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
      let taxonomyNodeIdToAssign = selectedTaxonomyNodeId;
      if (!taxonomyNodeIdToAssign && normalizedNewSubcategory && selectedTopLevelNode) {
        (conn.reducers as unknown as {
          createTopicTaxonomyNode?: (args: { name: string; parentId: bigint | null }) => void;
        }).createTopicTaxonomyNode?.({
          name: normalizedNewSubcategory,
          parentId: BigInt(selectedTopLevelNode.id),
        });
        await new Promise((r) => setTimeout(r, 350));
        const created = [...useTopicStore.getState().taxonomyNodes.values()].find(
          (n) =>
            n.parentId === selectedTopLevelNode.id &&
            n.name.toLowerCase() === normalizedNewSubcategory.toLowerCase()
        );
        if (created) taxonomyNodeIdToAssign = created.id;
      }

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
      const targetTopicId = newTopic?.id ?? null;
      const targetTopicSlug = newTopic?.slug ?? null;

      if (targetTopicId !== null) {
        if (taxonomyNodeIdToAssign) {
          (conn.reducers as unknown as { setTopicTaxonomy?: (args: { topicId: bigint; taxonomyNodeId: bigint }) => void })
            .setTopicTaxonomy?.({
              topicId: BigInt(targetTopicId),
              taxonomyNodeId: BigInt(taxonomyNodeIdToAssign),
            });
        }
        const ownerName = user?.username || user?.displayName || "Anonymous";
        conn.reducers.claimBlockInTopic({
          topicId: BigInt(targetTopicId),
          videoId: starterVideoId,
          platform: starterMeta.platform,
          thumbnailUrl: normalizeThumbnailForStorage(starterMeta.thumbnailUrl, starterMeta.platform),
          ownerName,
          ytViews: BigInt(0),
          ytLikes: BigInt(0),
        });
      }

      router.push(targetTopicSlug ? `/t/${targetTopicSlug}` : "/");
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

                {titleTaken && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 11a1 1 0 110-2 1 1 0 010 2zm1-4H7V5h2v3z" />
                    </svg>
                    This title is already taken. Titles must be unique.
                  </p>
                )}

                {slug && (
                  <Badge variant="outline" className="mt-2 inline-flex items-center overflow-hidden rounded-full bg-surface-light px-3 py-1 text-xs">
                    <span className="text-muted">myvoice.app/t/</span>
                    <span className="font-semibold text-accent">{slug}</span>
                  </Badge>
                )}
                <p className="mt-2 text-xs text-muted">
                  Tip: concrete titles perform best (e.g. &quot;Best parkour clips 2026&quot;).
                </p>
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
                  Starter content URL <span className="font-normal normal-case tracking-normal text-accent">required</span>
                </label>
                <Input
                  id="topic-youtube-url"
                  type="url"
                  value={starterUrl}
                  onChange={(e) => handleStarterUrlChange(e.target.value)}
                  placeholder="https://youtube.com/... or https://tiktok.com/... or https://bilibili.com/..."
                  className="h-11 rounded-xl border-border bg-surface-light px-4 placeholder-muted/50"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-muted">This post is pre-populated at x=0, y=0 for the new topic.</p>
                {starterUrl.trim() && isResolvingStarter && (
                  <p className="mt-1 text-xs text-muted">Resolving media metadata...</p>
                )}
                {starterUrl.trim() && !isResolvingStarter && !starterMeta && (
                  <p className="mt-1 text-xs text-red-400">Unsupported URL. Use YouTube, TikTok, or BiliBili.</p>
                )}
              </div>
            </div>
            </CardContent>
          </Card>

          <Card className="gap-0 border-border bg-surface py-0">
            <CardContent className="p-4 sm:p-5">
            <label
              htmlFor="topic-category-search"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Category
            </label>
            <ClearableInput
              id="topic-category-search"
              value={categorySearch}
              onChange={(e) => {
                setCategorySearch(e.target.value);
                setError(null);
              }}
              onClear={() => { setCategorySearch(""); setError(null); }}
              placeholder="Search categories..."
              className="h-11 w-full rounded-xl border-border bg-surface-light px-4"
              disabled={isSubmitting}
            />
            <Select
              value={categoryInput}
              onValueChange={(v) => {
                setCategoryInput(v);
                setSubcategoryInput("");
                setSubcategorySearch("");
                setNewSubcategoryName("");
                setError(null);
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger id="topic-category" className="mt-2 h-11 w-full rounded-xl bg-surface-light">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categorySearch.trim() ? (
                  // Flat filtered results while searching
                  categoryMatches.length > 0
                    ? categoryMatches.map((label) => (
                        <SelectItem key={label} value={label}>
                          {label}
                        </SelectItem>
                      ))
                    : <SelectItem value="__empty__" disabled>No matches</SelectItem>
                ) : (
                  // Grouped list when not searching
                  CATEGORY_GROUPS.map((group, gi) => (
                    <SelectGroup key={group.label}>
                      {gi > 0 && <SelectSeparator />}
                      <SelectLabel className="text-[11px] uppercase tracking-widest text-muted-foreground/60 px-2 pb-1">
                        {group.label}
                      </SelectLabel>
                      {group.items.map((label) => (
                        <SelectItem key={label} value={label}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))
                )}
              </SelectContent>
            </Select>
            {childNodes.length > 0 && (
              <>
                <label
                  htmlFor="topic-subcategory-search"
                  className="mt-3 mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  Subcategory search <span className="font-normal normal-case tracking-normal">optional</span>
                </label>
                <ClearableInput
                  id="topic-subcategory-search"
                  value={subcategorySearch}
                  onChange={(e) => {
                    setSubcategorySearch(e.target.value);
                    setError(null);
                  }}
                  onClear={() => { setSubcategorySearch(""); setError(null); }}
                  placeholder="Search subcategories..."
                  className="h-11 w-full rounded-xl border-border bg-surface-light px-4"
                  disabled={isSubmitting}
                />
                <label
                  htmlFor="topic-subcategory"
                  className="mt-3 mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  Subcategory <span className="font-normal normal-case tracking-normal">optional</span>
                </label>
                <Select
                  value={subcategoryInput || "__none__"}
                  onValueChange={(v) => {
                    setSubcategoryInput(v === "__none__" ? "" : v);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="topic-subcategory" className="h-11 w-full rounded-xl bg-surface-light">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {subcategoryMatches.map((node) => (
                      <SelectItem key={node.id} value={node.name}>
                        {node.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subcategorySearch.trim() && subcategoryMatches.length === 0 && (
                  <p className="mt-1 text-xs text-muted">No matching subcategories. Leave as None or create one below.</p>
                )}
              </>
            )}
            <label
              htmlFor="topic-new-subcategory"
              className="mt-3 mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Create subcategory <span className="font-normal normal-case tracking-normal">optional</span>
            </label>
            <Input
              id="topic-new-subcategory"
              value={newSubcategoryName}
              onChange={(e) => {
                setNewSubcategoryName(e.target.value);
                setError(null);
              }}
              placeholder={selectedTopLevelNode ? `e.g. ${selectedTopLevelNode.name} / New Subtopic` : "Pick a category first"}
              className="h-11 w-full rounded-xl border-border bg-surface-light px-4"
              disabled={isSubmitting || !selectedTopLevelNode}
            />
            <p className="mt-1 text-xs text-muted">
              Any signed-in user can create subcategories under an existing top-level category.
            </p>
            <p className="mt-2 text-xs text-muted">Use search to filter, then pick a category from the dropdown.</p>
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

          <div className="hidden lg:block space-y-2">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
                className="h-11 flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit && isAuthenticated}
                className="h-11 flex-2 rounded-xl"
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
            </div>
            {canSubmit && !isSubmitting && (
              <p className="text-center text-xs text-muted">
                You will be taken straight to your new topic.{" "}
                <kbd className="rounded bg-surface-light px-1 py-0.5 font-mono text-[10px]">Ctrl/Cmd + Enter</kbd>
              </p>
            )}
          </div>
        </div>

        <aside className="order-last lg:order-0 lg:sticky lg:top-20">
          <p className="mb-2 text-xs text-muted">Preview</p>
          <PreviewCard
            title={title}
            category={normalizedCategory ?? (categoryInput || "Entertainment")}
            starterVideoId={starterVideoId}
            starterPlatform={starterPlatform}
            starterThumbnailUrl={starterThumbnailUrl}
          />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/90 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:px-8 lg:hidden">
        <div className="mx-auto w-full max-w-3xl space-y-1.5">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="h-11 flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit && isAuthenticated}
              className="h-11 flex-2 rounded-xl"
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
          </div>
          {canSubmit && !isSubmitting && (
            <p className="text-center text-xs text-muted">You will be taken straight to your new topic.</p>
          )}
        </div>
      </div>
    </form>
  );
}
