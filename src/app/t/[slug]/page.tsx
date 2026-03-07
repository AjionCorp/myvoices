"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Header } from "@/components/ui/Header";
import { LoginButton } from "@/components/auth/LoginButton";
import { BlockDetailPanel } from "@/components/canvas/BlockDetailPanel";
import { SubmissionModal } from "@/components/canvas/SubmissionModal";
import { AddVideoModal } from "@/components/canvas/AddVideoModal";
import { ExploreLoginModal } from "@/components/canvas/ExploreLoginModal";
import { Minimap } from "@/components/canvas/Minimap";
import { ViewerCursors } from "@/components/canvas/ViewerCursors";
import { CanvasViewport } from "@/components/canvas/CanvasViewport";
import { useCanvasStore } from "@/stores/canvas-store";
import { useBlocksStore } from "@/stores/blocks-store";
import { useTopicStore } from "@/stores/topic-store";
import { useTopicBlocksSubscription } from "@/components/spacetimedb/SpacetimeDBProvider";
import { getConnection } from "@/lib/spacetimedb/client";
import { startViewerSimulation, useViewersStore } from "@/stores/viewers-store";
import { AnonymousViewportFetcher } from "@/lib/spacetimedb/AnonymousViewportFetcher";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TopicPickerModal } from "@/components/compare/TopicPickerModal";
import { cn } from "@/lib/utils";

const VideoCanvas = dynamic(
  () =>
    import("@/components/canvas/VideoCanvas").then((mod) => ({
      default: mod.VideoCanvas,
    })),
  { ssr: false }
);

function TopicOwnerMenu({ topicId, topicCreatorIdentity }: { topicId: number; topicCreatorIdentity: string }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const blocks = useBlocksStore((s) => s.blocks);
  const moderators = useTopicStore((s) => s.moderators);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preferredSuccessorIdentity, setPreferredSuccessorIdentity] = useState("");

  const isCreator = !!user?.identity && user.identity === topicCreatorIdentity;
  if (!isCreator) return null;

  const claimedBlocks = [...blocks.values()].filter(
    (b) => b.topicId === topicId && b.status === "claimed"
  );
  const hasOthers = claimedBlocks.some((b) => b.ownerIdentity !== user?.identity);
  const activeModeratorIdentities = [...moderators.values()]
    .filter((m) => m.topicId === topicId && m.status === "active" && m.identity !== user?.identity)
    .map((m) => m.identity);
  const activeModeratorSet = new Set(activeModeratorIdentities);
  const otherContributorIdentities = [...new Set(
    claimedBlocks
      .filter((b) => b.ownerIdentity && b.ownerIdentity !== user?.identity)
      .map((b) => b.ownerIdentity as string)
  )].filter((identity) => !activeModeratorSet.has(identity));

  const resolveUserLabel = (identity: string): string => {
    const conn = getConnection();
    const profile = conn?.db.user_profile.identity.find(identity);
    if (profile?.username) return profile.username;
    if (profile?.displayName) return profile.displayName;
    return identity.length > 20 ? `${identity.slice(0, 20)}…` : identity;
  };

  const label = hasOthers ? "Leave Topic" : "Delete Topic";
  const confirmMsg = hasOthers
    ? "You have other contributors. Your videos will be removed and ownership will transfer to an active moderator first, then to the last active contributor if no moderator is eligible."
    : "This will permanently delete the topic and all its videos.";

  const handleConfirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      const conn = getConnection();
      if (!conn) throw new Error("Not connected");
      conn.reducers.deleteTopic({
        topicId: BigInt(topicId),
        preferredNewOwnerIdentity: preferredSuccessorIdentity || undefined,
      });
      router.push("/");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <div className="relative">
      {!confirm ? (
        <Button
          onClick={() => { setConfirm(true); setErr(null); setPreferredSuccessorIdentity(""); }}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted hover:text-red-400"
          title={label}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          {label}
        </Button>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5">
          <div className="space-y-2">
            <p className="max-w-[320px] text-xs text-red-300">{confirmMsg}</p>
            {hasOthers && (
              <div className="space-y-1">
                <p className="text-[11px] text-red-200/80">Optional: choose a new owner now</p>
                <Select
                  value={preferredSuccessorIdentity || "__auto__"}
                  onValueChange={(v) => setPreferredSuccessorIdentity(v === "__auto__" ? "" : v)}
                  disabled={busy}
                >
                  <SelectTrigger className="h-7 w-full max-w-[320px] text-xs border-red-400/20 bg-background/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Auto-select best candidate</SelectItem>
                    {activeModeratorIdentities.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-[10px]">Active moderators</SelectLabel>
                        {activeModeratorIdentities.map((identity) => (
                          <SelectItem key={`mod-${identity}`} value={identity}>
                            {resolveUserLabel(identity)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {otherContributorIdentities.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-[10px]">Contributors</SelectLabel>
                        {otherContributorIdentities.map((identity) => (
                          <SelectItem key={`contrib-${identity}`} value={identity}>
                            {resolveUserLabel(identity)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5 self-start">
            <Button
              onClick={() => { setConfirm(false); setErr(null); setPreferredSuccessorIdentity(""); }}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted"
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              size="sm"
              className="h-6 bg-red-600 px-2 text-xs text-white hover:bg-red-700"
              disabled={busy}
            >
              {busy ? "…" : "Confirm"}
            </Button>
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
      )}
    </div>
  );
}

function TopicModerationMenu({ topicId, topicCreatorIdentity }: { topicId: number; topicCreatorIdentity: string }) {
  const user = useAuthStore((s) => s.user);
  const isModeratorForTopic = useTopicStore((s) => s.isModeratorForTopic);
  const getPendingApplicationsForTopic = useTopicStore((s) => s.getPendingApplicationsForTopic);
  const moderators = useTopicStore((s) => s.moderators);
  const moderatorApplications = useTopicStore((s) => s.moderatorApplications);
  const [showPanel, setShowPanel] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyMessage, setApplyMessage] = useState("I can help keep this topic high quality.");
  const [isApplying, setIsApplying] = useState(false);

  const userIdentity = user?.identity ?? null;
  const isOwner = !!userIdentity && userIdentity === topicCreatorIdentity;
  const isAdmin = !!user?.isAdmin;
  const isModerator = isModeratorForTopic(topicId, userIdentity);
  const canReview = isOwner || isAdmin || isModerator;
  const pending = getPendingApplicationsForTopic(topicId);
  const activeModerators = [...moderators.values()]
    .filter((m) => m.topicId === topicId && m.status === "active")
    .sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (a.role !== "owner" && b.role === "owner") return 1;
      return a.identity.localeCompare(b.identity);
    });
  const myPendingApplication = [...moderatorApplications.values()].find(
    (a) => a.topicId === topicId && a.applicantIdentity === userIdentity && a.status === "pending"
  );
  const canApply = !!userIdentity && !isModerator && !isOwner && !isAdmin;

  const [banTarget, setBanTarget] = useState("");
  const [banReason, setBanReason] = useState("");
  const [showBanForm, setShowBanForm] = useState(false);
  const [removeConfirmIdentity, setRemoveConfirmIdentity] = useState<string | null>(null);

  const reducers = (getConnection()?.reducers as unknown as {
    applyTopicModerator?: (args: { topicId: bigint; message: string }) => void;
    reviewTopicModeratorApplication?: (args: { applicationId: bigint; approve: boolean }) => void;
    removeTopicModerator?: (args: { topicId: bigint; identity: string }) => void;
    banUserFromTopic?: (args: { topicId: bigint; targetIdentity: string; reason: string }) => void;
    unbanUserFromTopic?: (args: { topicId: bigint; targetIdentity: string }) => void;
  }) || {};

  // Get banned users for this topic
  const bannedUsers = (() => {
    const conn = getConnection();
    if (!conn) return [];
    const bans: { id: number; bannedIdentity: string; reason: string; bannedBy: string }[] = [];
    for (const b of conn.db.topic_ban.iter()) {
      if (Number(b.topicId) === topicId) {
        bans.push({
          id: Number(b.id),
          bannedIdentity: b.bannedIdentity,
          reason: b.reason,
          bannedBy: b.bannedBy,
        });
      }
    }
    return bans;
  })();

  const handleApply = () => {
    setApplyMessage("I can help keep this topic high quality.");
    setShowApplyModal(true);
  };

  const submitApplication = () => {
    if (!applyMessage.trim()) return;
    setIsApplying(true);
    reducers.applyTopicModerator?.({
      topicId: BigInt(topicId),
      message: applyMessage.trim(),
    });
    setIsApplying(false);
    setShowApplyModal(false);
  };

  const handleReview = (applicationId: number, approve: boolean) => {
    setBusyId(applicationId);
    try {
      reducers.reviewTopicModeratorApplication?.({
        applicationId: BigInt(applicationId),
        approve,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveModerator = (identity: string) => {
    setRemoveConfirmIdentity(identity);
  };

  const confirmRemoveModerator = () => {
    if (!removeConfirmIdentity) return;
    reducers.removeTopicModerator?.({
      topicId: BigInt(topicId),
      identity: removeConfirmIdentity,
    });
    setRemoveConfirmIdentity(null);
  };

  const resolveUserLabel = (identity: string): string => {
    const conn = getConnection();
    const profile = conn?.db.user_profile.identity.find(identity);
    if (profile?.username) return profile.username;
    if (profile?.displayName) return profile.displayName;
    return identity.length > 20 ? `${identity.slice(0, 20)}…` : identity;
  };

  return (
    <div className="flex items-center gap-2">
      {canApply && (
        <Button
          onClick={handleApply}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted hover:text-foreground"
          disabled={!!myPendingApplication}
        >
          {myPendingApplication ? "Application Pending" : "Apply to Mod"}
        </Button>
      )}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="border-border bg-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request moderator access</DialogTitle>
            <DialogDescription>
              Tell the owner why you should help moderate this topic.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">Your message</label>
            <Textarea
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              maxLength={400}
              rows={4}
              placeholder="Share your moderation experience or goals for this topic."
              className="resize-none bg-background"
            />
            <p className="text-right text-[11px] text-muted">{applyMessage.length}/400</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApplyModal(false)}
              disabled={isApplying}
            >
              Cancel
            </Button>
            <Button
              onClick={submitApplication}
              disabled={!applyMessage.trim() || isApplying}
            >
              {isApplying ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(canReview || activeModerators.length > 0) && (
        <Popover open={showPanel} onOpenChange={setShowPanel}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted hover:text-foreground"
            >
              Community ({activeModerators.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-3" align="end" side="bottom">
            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">Moderators</p>
              <div className="space-y-2">
                {activeModerators.map((mod) => (
                  <div key={mod.id} className="rounded-lg border border-border bg-surface p-2">
                    {removeConfirmIdentity === mod.identity ? (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-red-300">Remove {resolveUserLabel(mod.identity)}?</p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] text-muted"
                            onClick={() => setRemoveConfirmIdentity(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-5 bg-red-600 px-1.5 text-[10px] text-white hover:bg-red-700"
                            onClick={confirmRemoveModerator}
                          >
                            Confirm
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-foreground">{resolveUserLabel(mod.identity)}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                            {mod.role}
                          </Badge>
                          {(isOwner || isAdmin) && mod.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-red-300 hover:text-red-200"
                              onClick={() => handleRemoveModerator(mod.identity)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {canReview && (
                <>
                  <p className="mb-2 mt-3 text-xs font-semibold text-foreground">
                    Pending applications ({pending.length})
                  </p>
                  <div className="space-y-2">
                    {pending.length === 0 ? (
                      <p className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-muted">
                        No pending applications.
                      </p>
                    ) : (
                      pending.map((app) => (
                        <div key={app.id} className="rounded-lg border border-border bg-surface p-2">
                          <p className="truncate text-xs text-foreground">{resolveUserLabel(app.applicantIdentity)}</p>
                          <p className="mt-1 text-xs text-muted">{app.message || "No message provided."}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleReview(app.id, true)}
                              disabled={busyId === app.id}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-muted"
                              onClick={() => handleReview(app.id, false)}
                              disabled={busyId === app.id}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* Banned users section */}
              {canReview && (
                <>
                  <p className="mb-2 mt-3 text-xs font-semibold text-foreground">
                    Banned users ({bannedUsers.length})
                  </p>
                  <div className="space-y-2">
                    {bannedUsers.map((ban) => (
                      <div key={ban.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs text-foreground">{resolveUserLabel(ban.bannedIdentity)}</p>
                          {ban.reason && <p className="truncate text-[10px] text-muted">{ban.reason}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 shrink-0 px-1.5 text-[10px] text-green-400 hover:text-green-300"
                          onClick={() => reducers.unbanUserFromTopic?.({ topicId: BigInt(topicId), targetIdentity: ban.bannedIdentity })}
                        >
                          Unban
                        </Button>
                      </div>
                    ))}
                    {!showBanForm ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-full text-xs text-muted hover:text-foreground"
                        onClick={() => setShowBanForm(true)}
                      >
                        + Ban a user
                      </Button>
                    ) : (
                      <div className="space-y-1.5 rounded-lg border border-border bg-surface p-2">
                        <Input
                          type="text"
                          placeholder="Username or identity"
                          value={banTarget}
                          onChange={(e) => setBanTarget(e.target.value)}
                          className="h-7 text-xs"
                        />
                        <Input
                          type="text"
                          placeholder="Reason (optional)"
                          value={banReason}
                          onChange={(e) => setBanReason(e.target.value)}
                          className="h-7 text-xs"
                        />
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="h-6 px-2 text-xs bg-red-600 text-white hover:bg-red-700"
                            disabled={!banTarget.trim()}
                            onClick={() => {
                              // Resolve username to identity if needed
                              const conn = getConnection();
                              let identity = banTarget.trim();
                              if (conn) {
                                for (const p of conn.db.user_profile.iter()) {
                                  if (p.username === identity || p.displayName === identity) {
                                    identity = p.identity;
                                    break;
                                  }
                                }
                              }
                              reducers.banUserFromTopic?.({ topicId: BigInt(topicId), targetIdentity: identity, reason: banReason.trim() });
                              setBanTarget("");
                              setBanReason("");
                              setShowBanForm(false);
                            }}
                          >
                            Ban
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted"
                            onClick={() => { setShowBanForm(false); setBanTarget(""); setBanReason(""); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function TopicSidebarPanel({ slug, open }: { slug: string; open: boolean }) {
  const topics = useTopicStore((s) => s.topics);
  const taxonomyNodes = useTopicStore((s) => s.taxonomyNodes);
  const activeTopic = useTopicStore((s) => s.activeTopic);
  const topic = activeTopic || [...topics.values()].find((t) => t.slug === slug);
  const viewers = useViewersStore((s) => s.viewers);
  const { totalClaimed } = useBlocksStore();
  const user = useAuthStore((s) => s.user);

  const [followState, setFollowState] = useState(false);
  const isFollowing = !!user && !!topic && followState;

  useEffect(() => {
    if (!user || !topic) {
      const timer = setTimeout(() => setIsFollowing(false), 0);
      return () => clearTimeout(timer);
    }
    const conn = getConnection();
    if (!conn) {
      const resetTimer = setTimeout(() => setIsFollowing(false), 0);
      return () => clearTimeout(resetTimer);
    }
    const check = () => {
      const following = [...conn.db.topic_follow.iter()].some(
        (f) => f.followerIdentity === user.identity && Number(f.topicId) === topic.id
      );
      setFollowState(following);
    };
    const checkTimer = setTimeout(check, 0);
    const unsubInsert: unknown = conn.db.topic_follow.onInsert(() => check());
    const unsubDelete: unknown = conn.db.topic_follow.onDelete(() => check());
    const runCleanup = (unsubscribe: unknown) => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
    return () => {
      clearTimeout(checkTimer);
      runCleanup(unsubInsert);
      runCleanup(unsubDelete);
    };
  }, [user, topic]);

  const showFollowing = !!user && !!topic && isFollowing;

  const handleToggleFollow = () => {
    if (!topic) return;
    const conn = getConnection();
    if (!conn) return;
    if (showFollowing) {
      conn.reducers.unfollowTopic({ topicId: BigInt(topic.id) });
    } else {
      conn.reducers.followTopic({ topicId: BigInt(topic.id) });
    }
  };

  const taxonomyPath =
    topic?.taxonomyPath ||
    (topic?.taxonomyNodeId ? taxonomyNodes.get(topic.taxonomyNodeId)?.path : undefined) ||
    "";
  const taxonomyParts = taxonomyPath ? taxonomyPath.split("/").filter(Boolean) : [];

  const subtopics = useMemo(() => {
    if (!topic || !taxonomyPath) return [];
    const childPrefix = `${taxonomyPath}/`;
    const currentDepth = taxonomyParts.length;
    return [...topics.values()]
      .filter((candidate) => {
        if (candidate.id === topic.id) return false;
        const candidatePath =
          candidate.taxonomyPath ||
          (candidate.taxonomyNodeId ? taxonomyNodes.get(candidate.taxonomyNodeId)?.path : "") ||
          "";
        if (!candidatePath.startsWith(childPrefix)) return false;
        const depth = candidatePath.split("/").filter(Boolean).length;
        return depth === currentDepth + 1;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [taxonomyNodes, taxonomyParts.length, taxonomyPath, topic, topics]);

  return (
    <div
      className={cn(
        "pointer-events-auto absolute top-0 left-0 bottom-0 z-20 w-72 overflow-y-auto border-r border-border/50 bg-background/95 backdrop-blur-md transition-transform duration-300 ease-in-out",
        open ? "translate-x-0 shadow-xl" : "-translate-x-full"
      )}
    >
      {/* spacer matching header bar height (py-2 + h-7 content = 44px) */}
      <div className="h-11 shrink-0" />

      {/* Topic info */}
      {topic && (
        <div className="border-b border-border/50 p-4">
          <h2 className="mb-1 text-sm font-semibold text-foreground">{topic.title}</h2>
          {taxonomyParts.length > 0 && (
            <p className="mb-2 text-[11px] text-muted">{taxonomyParts.join(" › ")}</p>
          )}
          {topic.description && (
            <p className="mb-3 text-xs leading-relaxed text-muted">{topic.description}</p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-1 text-xs text-muted">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {(topic.totalViews || 0).toLocaleString()} views
            </div>
            <div className="flex items-center gap-1 text-xs text-muted">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              {(topic.totalLikes || 0).toLocaleString()} likes
            </div>
            <div className="flex items-center gap-1 text-xs text-muted">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              {totalClaimed.toLocaleString()} videos
            </div>
          </div>
          {user && (
            <Button
              onClick={handleToggleFollow}
              variant={showFollowing ? "outline" : "default"}
              size="sm"
              className="mt-3 w-full text-xs"
            >
              {showFollowing ? "Following" : "Follow Topic"}
            </Button>
          )}
        </div>
      )}

      {/* Viewers online */}
      <div className="border-b border-border/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          <h3 className="text-xs font-semibold text-foreground">{viewers.length} Viewing Now</h3>
        </div>
        <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
          {viewers.map((viewer) => (
            <div
              key={viewer.id}
              className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface/60 transition-colors"
            >
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: viewer.color }}
              >
                {viewer.name[0]}
              </div>
              <span className="truncate text-xs text-foreground">{viewer.name}</span>
              <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-green-400 opacity-80" />
            </div>
          ))}
        </div>
      </div>

      {/* Subtopics */}
      {subtopics.length > 0 && (
        <div className="p-4">
          <h3 className="mb-3 text-xs font-semibold text-foreground">
            Subtopics
            <span className="ml-1.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-muted">
              {subtopics.length}
            </span>
          </h3>
          <div className="space-y-2">
            {subtopics.map((subtopic) => (
              <Link
                key={subtopic.id}
                href={`/t/${subtopic.slug}`}
                className="group flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent/40 hover:bg-surface/80"
              >
                <span className="text-xs font-medium text-foreground group-hover:text-accent transition-colors">
                  {subtopic.title}
                </span>
                {subtopic.description && (
                  <span className="line-clamp-2 text-[11px] leading-relaxed text-muted">
                    {subtopic.description}
                  </span>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] text-muted">{subtopic.videoCount || 0} videos</span>
                  {subtopic.totalViews != null && subtopic.totalViews > 0 && (
                    <span className="text-[10px] text-muted">· {subtopic.totalViews.toLocaleString()} views</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no subtopics */}
      {subtopics.length === 0 && topic && (
        <div className="p-4">
          <h3 className="mb-2 text-xs font-semibold text-foreground">Subtopics</h3>
          <p className="rounded-lg border border-border/50 bg-surface/50 px-3 py-2.5 text-[11px] text-muted">
            No subtopics yet for this topic.
          </p>
        </div>
      )}
    </div>
  );
}

function TopicHeader({ slug, sidebarOpen, onToggleSidebar }: { slug: string; sidebarOpen: boolean; onToggleSidebar: () => void }) {
  const router = useRouter();
  const topics = useTopicStore((s) => s.topics);
  const taxonomyNodes = useTopicStore((s) => s.taxonomyNodes);
  const moderators = useTopicStore((s) => s.moderators);
  const activeTopic = useTopicStore((s) => s.activeTopic);
  const topic = activeTopic || [...topics.values()].find((t) => t.slug === slug);
  const { totalClaimed } = useBlocksStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showSubtopics, setShowSubtopics] = useState(false);
  const [comparePickerOpen, setComparePickerOpen] = useState(false);
  const moderatorCount = useMemo(() => {
    if (!topic) return 0;
    return [...moderators.values()].filter((m) => m.topicId === topic.id && m.status === "active").length;
  }, [moderators, topic]);

  const taxonomyPath =
    topic?.taxonomyPath ||
    (topic?.taxonomyNodeId ? taxonomyNodes.get(topic.taxonomyNodeId)?.path : undefined) ||
    "";
  const taxonomyName =
    topic?.taxonomyName ||
    (topic?.taxonomyNodeId ? taxonomyNodes.get(topic.taxonomyNodeId)?.name : undefined) ||
    "";
  const taxonomyParts = taxonomyPath ? taxonomyPath.split("/").filter(Boolean) : [];
  const subtopics = useMemo(() => {
    if (!topic || !taxonomyPath) return [];
    const childPrefix = `${taxonomyPath}/`;
    const currentDepth = taxonomyParts.length;
    return [...topics.values()]
      .filter((candidate) => {
        if (candidate.id === topic.id) return false;
        const candidatePath =
          candidate.taxonomyPath ||
          (candidate.taxonomyNodeId ? taxonomyNodes.get(candidate.taxonomyNodeId)?.path : "") ||
          "";
        if (!candidatePath.startsWith(childPrefix)) return false;
        const depth = candidatePath.split("/").filter(Boolean).length;
        return depth === currentDepth + 1;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [taxonomyNodes, taxonomyParts.length, taxonomyPath, topic, topics]);

  return (
    <div className="pointer-events-auto absolute top-0 left-0 right-0 z-30">
      <div className="flex items-center bg-background/80 px-4 py-2 backdrop-blur-sm border-b border-border/50">
        {/* left: hamburger + breadcrumb + title + meta + action */}
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <Button
            onClick={onToggleSidebar}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 shrink-0 p-0 transition-colors",
              sidebarOpen && "bg-surface text-foreground"
            )}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Link href="/" className="text-muted hover:text-foreground transition-colors text-sm shrink-0">
            ← Topics
          </Link>
          <span className="text-border shrink-0">/</span>
          {topic ? (
            <>
              <h1 className="text-sm font-semibold text-foreground truncate">
                {topic.title}
              </h1>
              {taxonomyParts.length > 0 && (
                <span className="text-xs text-muted truncate">{taxonomyParts.join(" / ")}</span>
              )}
              <span className="flex items-center gap-3 text-xs text-muted shrink-0">
                <Badge variant="outline" className="rounded-md bg-surface text-xs">
                  {taxonomyName || topic.category}
                </Badge>
                <span>{totalClaimed.toLocaleString()} / ∞ videos</span>
                <span>{moderatorCount} mod{moderatorCount === 1 ? "" : "s"}</span>
                {subtopics.length > 0 && (
                  <Popover open={showSubtopics} onOpenChange={setShowSubtopics}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted hover:text-foreground"
                      >
                        Subtopics ({subtopics.length})
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-2" align="start" side="bottom">
                      {subtopics.map((subtopic) => (
                        <Link
                          key={subtopic.id}
                          href={`/t/${subtopic.slug}`}
                          className="block rounded-lg px-2 py-1.5 text-xs text-foreground hover:bg-surface"
                        >
                          {subtopic.title}
                        </Link>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}
                <Button
                  onClick={() => setComparePickerOpen(true)}
                  variant="outline"
                  size="sm"
                  className="pointer-events-auto h-7 rounded-lg px-3 text-xs"
                >
                  Compare
                </Button>
                <Button
                  onClick={() => useCanvasStore.getState().openSubmissionModal()}
                  size="sm"
                  className="pointer-events-auto h-7 rounded-lg px-3 text-xs font-semibold"
                >
                  + Add Video
                </Button>
                {isAuthenticated && (
                  <TopicOwnerMenu
                    topicId={topic.id}
                    topicCreatorIdentity={topic.creatorIdentity}
                  />
                )}
                <TopicModerationMenu
                  topicId={topic.id}
                  topicCreatorIdentity={topic.creatorIdentity}
                />
              </span>
            </>
          ) : (
            <span className="text-sm text-muted">Loading…</span>
          )}
        </div>

        {/* right: user avatar — always far right */}
        <div className="pointer-events-auto shrink-0 pl-4">
          <LoginButton />
        </div>
      </div>

      <TopicPickerModal
        open={comparePickerOpen}
        onClose={() => setComparePickerOpen(false)}
        excludeSlugs={topic ? [topic.slug] : []}
        onSelect={(picked) => router.push(`/compare/${slug}/${picked}`)}
        title="Compare with another topic"
        currentTopicCategory={topic?.category}
        currentTopicTaxonomyPath={taxonomyPath || undefined}
      />
    </div>
  );
}

export default function TopicPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { centerOn, screenWidth } = useCanvasStore();
  const loading = useBlocksStore((s) => s.loading);
  const { topics, setActiveTopic, getTopicBySlug } = useTopicStore();
  const { isLoading: authLoading, isAuthenticated } = useAuthStore();

  // Resolve topic from slug
  const topic = getTopicBySlug(slug);
  const topicId = topic?.id ?? null;

  // Set/clear the active topic when entering/leaving this page
  useEffect(() => {
    if (topic) {
      setActiveTopic(topic);
      // Increment view counter
      const conn = getConnection();
      if (conn) {
        conn.reducers.incrementTopicViews({ topicId: BigInt(topic.id) });
      }
    }
    return () => {
      setActiveTopic(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id]);

  // Subscribe to this topic's blocks
  useTopicBlocksSubscription(topicId);

  // Center viewport at (0,0) whenever the topic changes or screen dimensions become known
  useEffect(() => {
    if (screenWidth > 0) {
      centerOn(0, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenWidth, slug]);

  // Viewer cursor simulation
  useEffect(() => {
    const stop = startViewerSimulation();
    return stop;
  }, []);

  // Deep-link: center on a block
  useEffect(() => {
    if (loading) return;
    const blockParam = new URLSearchParams(window.location.search).get("block");
    if (blockParam) {
      const blockId = parseInt(blockParam, 10);
      const target = useBlocksStore.getState().blocks.get(blockId);
      if (target) {
        centerOn(target.x, target.y);
        useCanvasStore.getState().selectBlock(blockId);
      }
    }
  }, [loading, centerOn]);

  if (!topic && topics.size > 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Header />
        <h1 className="mt-8 text-xl font-semibold text-foreground">Topic not found</h1>
        <p className="mt-2 text-sm text-muted">
          The topic <code className="text-accent">{slug}</code> does not exist.
        </p>
        <Link href="/" className="mt-6 text-sm text-accent hover:underline">
          ← Back to all topics
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <VideoCanvas />
      <ViewerCursors />
      {!authLoading && !isAuthenticated && topicId !== null && (
        <AnonymousViewportFetcher topicId={topicId} />
      )}

      <TopicSidebarPanel slug={slug} open={sidebarOpen} />

      <div className="pointer-events-none absolute inset-0 z-30">
        <TopicHeader slug={slug} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
        <BlockDetailPanel />
        <SubmissionModal />
        <AddVideoModal />
        <Minimap />
        <CanvasViewport />
      </div>
      <ExploreLoginModal />
    </div>
  );
}
