"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin, Globe, UserPlus, UserMinus, MessageSquare,
  MoreHorizontal, Flag, VolumeX, Volume2, Pencil, Ban, ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCanvasStore } from "@/stores/canvas-store";
import { useAuthStore } from "@/stores/auth-store";
import { useFollowsStore } from "@/stores/follows-store";
import { useModerationStore } from "@/stores/moderation-store";
import { getConnection } from "@/lib/spacetimedb/client";
import { EditProfileDialog } from "@/components/profile/EditProfileDialog";
import { ReportDialog } from "@/components/profile/ReportDialog";
import type { ProfileUser } from "@/app/u/[username]/page";

interface UserCardProps {
  profileUser: ProfileUser;
  isOwnProfile: boolean;
  stats: {
    videoCount: number;
    topicCount: number;
    commentCount: number;
    karma: number;
    followerCount: number;
    followingCount: number;
  };
}

function SocialIcon({ type }: { type: "x" | "youtube" | "tiktok" | "instagram" }) {
  const size = 15;
  switch (type) {
    case "x":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "youtube":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );
    case "instagram":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
        </svg>
      );
  }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function UserCard({ profileUser, isOwnProfile, stats }: UserCardProps) {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const isFollowing = useFollowsStore((s) =>
    currentUser ? s.isFollowing(currentUser.identity, profileUser.identity) : false
  );
  const isBlockedByMe = useModerationStore((s) =>
    currentUser ? s.isBlockedByMe(currentUser.identity, profileUser.identity) : false
  );
  const isMuted = useModerationStore((s) =>
    currentUser ? s.isMuted(currentUser.identity, profileUser.identity) : false
  );

  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const { viewportX, viewportY, zoom, screenWidth, screenHeight } = useCanvasStore();

  const canvasCenterX = screenWidth / 2 - viewportX * zoom;
  const canvasCenterY = screenHeight / 2 - viewportY * zoom;

  const cardW = 340;
  const cardH = 420;

  const handleFollow = () => {
    const conn = getConnection();
    if (!conn || !currentUser) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        conn.reducers.unfollowUser({ targetIdentity: profileUser.identity });
      } else {
        conn.reducers.followUser({ targetIdentity: profileUser.identity });
      }
    } finally {
      setTimeout(() => setFollowBusy(false), 500);
    }
  };

  const handleMessage = () => {
    router.push("/messages");
  };

  const handleBlock = () => {
    const conn = getConnection();
    if (!conn || !currentUser) return;
    if (isBlockedByMe) {
      conn.reducers.unblockUser({ targetIdentity: profileUser.identity });
    } else {
      conn.reducers.blockUser({ targetIdentity: profileUser.identity });
    }
  };

  const handleMute = () => {
    const conn = getConnection();
    if (!conn || !currentUser) return;
    if (isMuted) {
      conn.reducers.unmuteUser({ targetIdentity: profileUser.identity });
    } else {
      conn.reducers.muteUser({ targetIdentity: profileUser.identity });
    }
  };

  const initials = profileUser.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const socials = [
    profileUser.socialX ? { type: "x" as const, url: `https://x.com/${profileUser.socialX}`, handle: profileUser.socialX } : null,
    profileUser.socialYoutube ? { type: "youtube" as const, url: `https://youtube.com/@${profileUser.socialYoutube}`, handle: profileUser.socialYoutube } : null,
    profileUser.socialTiktok ? { type: "tiktok" as const, url: `https://tiktok.com/@${profileUser.socialTiktok}`, handle: profileUser.socialTiktok } : null,
    profileUser.socialInstagram ? { type: "instagram" as const, url: `https://instagram.com/${profileUser.socialInstagram}`, handle: profileUser.socialInstagram } : null,
  ].filter(Boolean) as { type: "x" | "youtube" | "tiktok" | "instagram"; url: string; handle: string }[];

  return (
    <>
      <div
        className="pointer-events-auto absolute"
        style={{
          left: canvasCenterX - cardW / 2,
          top: canvasCenterY - cardH / 2,
          width: cardW,
          transform: `scale(${Math.min(Math.max(zoom, 0.5), 1.5)})`,
          transformOrigin: "center center",
          zIndex: 40,
        }}
      >
        <div
          className="flex flex-col items-center gap-3 rounded-2xl p-5"
          style={{
            background: "rgba(14,14,14,0.92)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {/* Blocked banner */}
          {isBlockedByMe && (
            <div className="flex w-full items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <Ban size={12} />
              <span>You blocked this user</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleBlock}
                className="ml-auto h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                Unblock
              </Button>
            </div>
          )}

          {/* Avatar */}
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold ${
              isBlockedByMe ? "opacity-40 grayscale" : ""
            }`}
            style={{
              background: "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
              color: "#fff",
            }}
          >
            {initials || "?"}
          </div>

          {/* Name + username */}
          <div className="text-center">
            <div className="text-[15px] font-semibold text-white">{profileUser.displayName}</div>
            <div className="text-xs text-white/45">@{profileUser.username}</div>
          </div>

          {/* Bio */}
          {profileUser.bio && !isBlockedByMe && (
            <p className="text-center text-xs leading-relaxed text-white/60" style={{ maxWidth: 280 }}>
              {profileUser.bio}
            </p>
          )}

          {/* Location + Website */}
          {!isBlockedByMe && (profileUser.location || profileUser.websiteUrl) && (
            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-white/45">
              {profileUser.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {profileUser.location}
                </span>
              )}
              {profileUser.websiteUrl && (
                <a
                  href={profileUser.websiteUrl.startsWith("http") ? profileUser.websiteUrl : `https://${profileUser.websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-accent hover:underline"
                >
                  <Globe size={11} /> {profileUser.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          )}

          {/* Social links */}
          {!isBlockedByMe && socials.length > 0 && (
            <div className="flex items-center gap-3">
              {socials.map((s) => (
                <a
                  key={s.type}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/40 transition-colors hover:text-white/80"
                  title={`@${s.handle}`}
                >
                  <SocialIcon type={s.type} />
                </a>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/50">
            <StatItem value={stats.karma} label="Karma" />
            <Sep />
            <StatItem value={stats.videoCount} label="Videos" />
            <Sep />
            <StatItem value={stats.topicCount} label="Topics" />
            <Sep />
            <StatItem value={stats.followerCount} label="Followers" />
            <Sep />
            <StatItem value={stats.followingCount} label="Following" />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            {isOwnProfile ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditOpen(true)}
                className="h-8 gap-1.5 border-white/15 bg-white/5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Pencil size={12} /> Edit Profile
              </Button>
            ) : isBlockedByMe ? (
              /* When blocked, only show the dropdown */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
                  >
                    <MoreHorizontal size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={handleBlock} className="gap-2 text-xs text-red-400">
                    <ShieldOff size={12} /> Unblock
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setReportOpen(true)} className="gap-2 text-xs">
                    <Flag size={12} /> Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={handleFollow}
                  disabled={followBusy || !currentUser}
                  className={
                    isFollowing
                      ? "h-8 gap-1.5 border border-white/15 bg-transparent text-xs text-white/80 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                      : "h-8 gap-1.5 bg-accent text-xs text-white hover:bg-accent/90"
                  }
                >
                  {isFollowing ? (
                    <>
                      <UserMinus size={12} /> Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus size={12} /> Follow
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMessage}
                  disabled={!currentUser}
                  className="h-8 gap-1.5 border-white/15 bg-white/5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <MessageSquare size={12} /> Message
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
                    >
                      <MoreHorizontal size={14} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={handleMute} className="gap-2 text-xs">
                      {isMuted ? (
                        <><Volume2 size={12} /> Unmute</>
                      ) : (
                        <><VolumeX size={12} /> Mute</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBlock} className="gap-2 text-xs text-red-400">
                      <Ban size={12} /> Block
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setReportOpen(true)} className="gap-2 text-xs">
                      <Flag size={12} /> Report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      {isOwnProfile && (
        <EditProfileDialog
          key={`${profileUser.identity}:${editOpen ? "open" : "closed"}`}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetIdentity={profileUser.identity}
        targetName={profileUser.username}
      />
    </>
  );
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="font-semibold text-white/80">{fmt(value)}</span>{" "}
      <span>{label}</span>
    </span>
  );
}

function Sep() {
  return <span className="text-white/15">·</span>;
}
