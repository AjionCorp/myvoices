"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Repeat2, CheckCheck, ThumbsUp, Mail, UserPlus, MessageSquare, Trophy, Video, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNotificationsStore, type NotificationType, type Notification } from "@/stores/notifications-store";
import { useModerationStore } from "@/stores/moderation-store";
import { useAuthStore } from "@/stores/auth-store";
import { getConnection } from "@/lib/spacetimedb/client";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts / 1000) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function NotificationIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case "comment_like": return <Heart className="h-3.5 w-3.5 text-rose-500" />;
    case "comment_repost": return <Repeat2 className="h-3.5 w-3.5 text-emerald-500" />;
    case "video_like": return <ThumbsUp className="h-3.5 w-3.5 text-amber-500" />;
    case "new_message": return <Mail className="h-3.5 w-3.5 text-blue-500" />;
    case "message_request": return <MessageSquare className="h-3.5 w-3.5 text-amber-500" />;
    case "new_follow": return <UserPlus className="h-3.5 w-3.5 text-violet-500" />;
    case "topic_new_video": return <Video className="h-3.5 w-3.5 text-cyan-500" />;
    case "contest_result": return <Trophy className="h-3.5 w-3.5 text-yellow-500" />;
    case "moderator_application_reviewed": return <Shield className="h-3.5 w-3.5 text-green-500" />;
    default: return <MessageCircle className="h-3.5 w-3.5 text-sky-500" />;
  }
}

function notificationLabel(type: NotificationType, actorName: string): string {
  switch (type) {
    case "comment_like": return `${actorName} liked your comment`;
    case "comment_reply": return `${actorName} replied to your comment`;
    case "comment_repost": return `${actorName} reposted your comment`;
    case "video_like": return `${actorName} liked your video`;
    case "new_message": return `${actorName} sent you a message`;
    case "message_request": return `${actorName} wants to send you a message`;
    case "new_follow": return `${actorName} followed you`;
    case "topic_new_video": return `New video in a topic you follow`;
    case "contest_result": return `Contest results are in!`;
    case "moderator_application_reviewed": return `Your moderator application was reviewed`;
    default: return `${actorName} interacted with your content`;
  }
}

/** Resolve a blockId to the topic slug it belongs to */
function resolveBlockTopicSlug(blockId: number): string | null {
  if (!blockId) return null;
  const conn = getConnection();
  if (!conn) return null;
  const block = conn.db.block?.id?.find(BigInt(blockId));
  if (!block) return null;
  const topicId = Number(block.topicId);
  const topic = conn.db.topic?.id?.find(BigInt(topicId));
  return topic?.slug ?? null;
}

/** Resolve an actor identity to their username */
function resolveUsername(identity: string): string | null {
  const conn = getConnection();
  if (!conn) return null;
  const profile = conn.db.user_profile.identity.find(identity);
  return profile?.username ?? null;
}

function getNotificationHref(notif: Notification): string | null {
  switch (notif.notificationType) {
    case "comment_reply":
    case "comment_like":
    case "comment_repost":
    case "video_like":
    case "topic_new_video": {
      const slug = resolveBlockTopicSlug(notif.blockId);
      if (slug) return `/t/${slug}?block=${notif.blockId}`;
      return null;
    }
    case "new_message":
    case "message_request":
      return "/messages";
    case "new_follow": {
      const username = resolveUsername(notif.actorIdentity);
      return username ? `/u/${username}` : null;
    }
    case "contest_result":
      return "/earnings";
    case "moderator_application_reviewed":
      return null;
    default:
      return null;
  }
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold text-accent">
      {initials}
    </div>
  );
}

export function NotificationPanel() {
  const router = useRouter();
  const notificationsMap = useNotificationsStore((s) => s.notifications);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  const myIdentity = useAuthStore((s) => s.user?.identity ?? "");
  const hiddenIds = useModerationStore(
    (s) => (myIdentity ? s.getHiddenIdentities(myIdentity) : new Set<string>())
  );

  const notifications = useMemo(
    () =>
      [...notificationsMap.values()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .filter((n) => !hiddenIds.has(n.actorIdentity)),
    [notificationsMap, hiddenIds]
  );

  const handleMarkAllRead = () => {
    markAllRead();
    const conn = getConnection();
    conn?.reducers.markAllNotificationsRead({});
  };

  const handleClick = (notif: Notification) => {
    if (!notif.isRead) {
      markRead(notif.id);
      const conn = getConnection();
      conn?.reducers.markNotificationRead({ notificationId: BigInt(notif.id) });
    }
    const href = getNotificationHref(notif);
    if (href) {
      router.push(href);
    }
  };

  return (
    <div className="flex w-80 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Notifications</span>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      <Separator className="opacity-30" />

      {/* Notification list */}
      {notifications.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">
          No notifications yet
        </p>
      ) : (
        <ScrollArea className="max-h-[420px]">
          <div className="flex flex-col">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/5 ${
                  !notif.isRead ? "bg-accent/6" : ""
                }`}
              >
                {/* Unread indicator */}
                <div className="mt-2 flex w-2 shrink-0 justify-center">
                  {!notif.isRead && (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  )}
                </div>

                <Avatar name={notif.actorName} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <NotificationIcon type={notif.notificationType} />
                    <p className="text-xs leading-snug text-foreground/90">
                      {notificationLabel(notif.notificationType, notif.actorName)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {timeAgo(notif.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
