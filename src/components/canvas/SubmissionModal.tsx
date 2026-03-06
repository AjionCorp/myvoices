"use client";

import { useEffect, useMemo, useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { useTopicStore } from "@/stores/topic-store";
import { useAuth } from "@/components/auth/AuthProvider";
import { getConnection } from "@/lib/spacetimedb/client";
import { getThumbnailUrl, normalizeThumbnailForStorage } from "@/lib/utils/video-url";
import { resolveVideoMeta, type ResolvedVideoMeta } from "@/lib/utils/video-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ClearableInput } from "@/components/ui/clearable-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SubmissionModal() {
  const { showSubmissionModal, closeSubmissionModal } = useCanvasStore();
  const { activeTopic } = useTopicStore();
  const topics = useTopicStore((s) => s.topics);
  const taxonomyNodes = useTopicStore((s) => s.taxonomyNodes);
  const { isAuthenticated, login, user } = useAuth();

  const [url, setUrl] = useState("");
  const [resolvedMeta, setResolvedMeta] = useState<ResolvedVideoMeta | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetTopicId, setTargetTopicId] = useState<number | null>(null);
  const [childSearch, setChildSearch] = useState("");

  useEffect(() => {
    setTargetTopicId(activeTopic?.id ?? null);
    setChildSearch("");
  }, [activeTopic?.id, showSubmissionModal]);

  useEffect(() => {
    const value = url.trim();
    if (!value) {
      setResolvedMeta(null);
      setIsResolving(false);
      return;
    }

    let cancelled = false;
    setIsResolving(true);
    const timer = setTimeout(async () => {
      try {
        const meta = await resolveVideoMeta(value);
        if (!cancelled) setResolvedMeta(meta);
      } catch {
        if (!cancelled) setResolvedMeta(null);
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url]);

  const thumbnailUrl = resolvedMeta
    ? getThumbnailUrl(resolvedMeta.videoId, resolvedMeta.platform, resolvedMeta.thumbnailUrl)
    : null;
  const topicTargeting = useMemo(() => {
    if (!activeTopic) return { isChildTopic: false, childOptions: [] as Array<{ id: number; title: string }> };
    const activeNode = activeTopic.taxonomyNodeId
      ? taxonomyNodes.get(activeTopic.taxonomyNodeId) ?? null
      : null;
    const currentPath =
      activeTopic.taxonomyPath ||
      (activeTopic.taxonomyNodeId ? taxonomyNodes.get(activeTopic.taxonomyNodeId)?.path : "") ||
      "";
    const currentDepth = currentPath.split("/").filter(Boolean).length;
    const childPrefix = currentPath ? `${currentPath}/` : "";
    const isChildTopic = !!activeNode && activeNode.parentId !== null;

    const childOptions = isChildTopic
      ? []
      : [...topics.values()]
      .filter((candidate) => {
        const candidatePath =
          candidate.taxonomyPath ||
          (candidate.taxonomyNodeId ? taxonomyNodes.get(candidate.taxonomyNodeId)?.path : "") ||
          "";
        if (!currentPath || !candidatePath) return false;
        if (candidatePath === currentPath) return false;
        if (!candidatePath.startsWith(childPrefix)) return false;
        const candidateDepth = candidatePath.split("/").filter(Boolean).length;
        return candidateDepth === currentDepth + 1;
      })
      .sort((a, b) => {
        return a.title.localeCompare(b.title);
      });

    return { isChildTopic, childOptions };
  }, [activeTopic, taxonomyNodes, topics]);
  const filteredChildOptions = useMemo(() => {
    if (!activeTopic || !topicTargeting || topicTargeting.isChildTopic) return [];
    const needle = childSearch.trim().toLowerCase();
    if (!needle) return topicTargeting.childOptions;
    return topicTargeting.childOptions.filter((option) => option.title.toLowerCase().includes(needle));
  }, [activeTopic, childSearch, topicTargeting]);

  const handleClose = () => {
    closeSubmissionModal();
    setUrl("");
    setResolvedMeta(null);
    setIsResolving(false);
    setError(null);
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      login();
      return;
    }

    if (!resolvedMeta || !activeTopic) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const conn = getConnection();
      if (!conn) {
        setError("Not connected to server. Please refresh.");
        setIsSubmitting(false);
        return;
      }

      const ownerName = user?.username || user?.displayName || "Anonymous";

      conn.reducers.claimBlockInTopic({
        topicId: BigInt(targetTopicId ?? activeTopic.id),
        videoId: resolvedMeta.videoId,
        platform: resolvedMeta.platform,
        thumbnailUrl: normalizeThumbnailForStorage(resolvedMeta.thumbnailUrl, resolvedMeta.platform),
        ownerName,
        ytViews: BigInt(0),
        ytLikes: BigInt(0),
      });

      handleClose();
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={showSubmissionModal} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-surface sm:max-w-md">
        <DialogHeader className="mb-2">
          <div>
            <DialogTitle>Add Video</DialogTitle>
            {activeTopic && (
              <p className="text-xs text-muted">
                to <span className="font-medium text-foreground">{activeTopic.title}</span>
              </p>
            )}
          </div>
        </DialogHeader>

        {!isAuthenticated && (
          <Card className="mb-4 gap-0 border-accent/30 bg-accent/10 py-0 shadow-none">
            <CardContent className="p-3 text-sm text-accent-light">
              You need to sign in to add a video.
            </CardContent>
          </Card>
        )}

        <div className="mb-4">
          {activeTopic && !topicTargeting.isChildTopic && topicTargeting.childOptions.length > 0 && (
            <div className="mb-3 space-y-2">
              <label className="block text-sm font-medium text-muted">Post into child (optional)</label>
              <ClearableInput
                type="text"
                value={childSearch}
                onChange={(e) => setChildSearch(e.target.value)}
                onClear={() => setChildSearch("")}
                placeholder="Search child topics..."
                className="h-10 bg-background"
                disabled={isSubmitting}
              />
              <Select
                value={targetTopicId && targetTopicId !== activeTopic.id ? String(targetTopicId) : "__main__"}
                onValueChange={(v) => setTargetTopicId(v === "__main__" ? activeTopic.id : Number(v))}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__main__">Keep in {activeTopic.title}</SelectItem>
                  {filteredChildOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {childSearch.trim() && filteredChildOptions.length === 0 && (
                <p className="text-xs text-muted">No child topics match your search.</p>
              )}
            </div>
          )}
          <label className="mb-1.5 block text-sm font-medium text-muted">
            Video URL
          </label>
          <Input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            placeholder="YouTube, TikTok, or BiliBili URL"
            className="h-10 bg-background"
            disabled={isSubmitting}
          />
          {url.trim() && isResolving && (
            <p className="mt-1.5 text-xs text-muted">Resolving metadata...</p>
          )}
          {url.trim() && !isResolving && !resolvedMeta && (
            <p className="mt-1.5 text-xs text-red-400">Enter a valid supported URL</p>
          )}
          {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>

        {thumbnailUrl && (
          <div className="mb-4 overflow-hidden rounded-xl border border-border bg-black">
            <img
              src={thumbnailUrl}
              alt="Video thumbnail"
              className="w-full object-cover"
            />
          </div>
        )}

        {!resolvedMeta && !url.trim() && (
          <p className="mb-4 text-center text-xs text-muted">
            Paste a supported link to preview and add
          </p>
        )}

        <div className="flex gap-3">
          <Button onClick={handleClose} variant="outline" className="flex-1" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!resolvedMeta || isSubmitting || isResolving}
            className="flex-1"
          >
            {isSubmitting
              ? "Adding..."
              : isAuthenticated
                ? "Add Video"
                : "Sign In to Add"}
          </Button>
        </div>

        <p className="mt-3 text-center text-xs text-muted">
          Your video will be added to the next available position in the spiral.
        </p>
      </DialogContent>
    </Dialog>
  );
}
