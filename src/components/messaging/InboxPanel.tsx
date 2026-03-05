"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useMessagesStore, type Conversation } from "@/stores/messages-store";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts / 1000) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold text-accent">
      {initials}
    </div>
  );
}

export function InboxPanel() {
  const getConversations = useMessagesStore((s) => s.getConversations);
  const myIdentity = useMessagesStore((s) => s.myIdentity);

  const conversations = getConversations().slice(0, 5);

  return (
    <div className="flex w-80 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Messages</span>
        <Link
          href="/messages"
          className="text-xs text-accent hover:underline"
        >
          See all
        </Link>
      </div>

      <Separator className="opacity-30" />

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Mail className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">No messages yet</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[420px]">
          <div className="flex flex-col">
            {conversations.map((conv: Conversation) => (
              <Link
                key={conv.otherIdentity}
                href="/messages"
                className={`flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/5 ${
                  conv.unreadCount > 0 ? "bg-accent/6" : ""
                }`}
              >
                <div className="mt-2.5 flex w-2 shrink-0 justify-center">
                  {conv.unreadCount > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  )}
                </div>

                <Avatar name={conv.otherName} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {conv.otherName}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(conv.lastMessage.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {conv.lastMessage.senderIdentity === myIdentity ? "You: " : ""}
                    {conv.lastMessage.text}
                  </p>
                </div>

                {conv.unreadCount > 0 && (
                  <span className="flex h-4 min-w-4 shrink-0 items-center justify-center self-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                    {conv.unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
