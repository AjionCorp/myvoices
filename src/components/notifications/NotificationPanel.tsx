"use client";

import { Heart, MessageCircle, Repeat2, CheckCheck, ThumbsUp, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNotificationsStore, type NotificationType } from "@/stores/notifications-store";
import { getConnection } from "@/lib/spacetimedb/client";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts / 1000) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function NotificationIcon({ type }: { type: NotificationType }) {
  if (type === "comment_like")
    return <Heart className="h-3.5 w-3.5 text-rose-500" />;
  if (type === "comment_repost")
    return <Repeat2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (type === "video_like")
    return <ThumbsUp className="h-3.5 w-3.5 text-amber-500" />;
  if (type === "new_message")
    return <Mail className="h-3.5 w-3.5 text-blue-500" />;
  return <MessageCircle className="h-3.5 w-3.5 text-sky-500" />;
}

function notificationLabel(type: NotificationType, actorName: string): string {
  switch (type) {
    case "comment_like":
      return `${actorName} liked your comment`;
    case "comment_reply":
      return `${actorName} replied to your comment`;
    case "comment_repost":
      return `${actorName} reposted your comment`;
    case "video_like":
      return `${actorName} liked your video`;
    case "new_message":
      return `${actorName} sent you a message`;
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
  const getAll = useNotificationsStore((s) => s.getAll);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  const notifications = getAll();

  const handleMarkAllRead = () => {
    markAllRead();
    const conn = getConnection();
    conn?.reducers.markAllNotificationsRead({});
  };

  const handleMarkRead = (id: number) => {
    markRead(id);
    const conn = getConnection();
    conn?.reducers.markNotificationRead({ notificationId: BigInt(id) });
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
            {notifications.map((notif, i) => (
              <button
                key={notif.id}
                onClick={() => !notif.isRead && handleMarkRead(notif.id)}
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
