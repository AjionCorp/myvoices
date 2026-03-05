"use client";

import type { Conversation } from "@/stores/messages-store";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts / 1000) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
      {initials}
    </div>
  );
}

interface Props {
  conversation: Conversation;
  isSelected: boolean;
  myIdentity: string;
  onClick: () => void;
}

export function ConversationItem({ conversation, isSelected, myIdentity, onClick }: Props) {
  const { otherName, lastMessage, unreadCount } = conversation;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/5 ${
        isSelected ? "bg-accent/10" : ""
      } ${unreadCount > 0 ? "bg-accent/[0.03]" : ""}`}
    >
      <Avatar name={otherName} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-sm ${
              unreadCount > 0 ? "font-bold text-foreground" : "font-medium text-foreground"
            }`}
          >
            {otherName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo(lastMessage.createdAt)}
          </span>
        </div>
        <p
          className={`mt-0.5 truncate text-xs ${
            unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"
          }`}
        >
          {lastMessage.senderIdentity === myIdentity ? "You: " : ""}
          {lastMessage.text}
        </p>
      </div>

      {unreadCount > 0 && (
        <span className="mt-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
