"use client";

import { useState } from "react";
import { Mail, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useMessagesStore, type Conversation } from "@/stores/messages-store";
import { getConnection } from "@/lib/spacetimedb/client";
import { MessageThread } from "./MessageThread";

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

type NewMessageState = { recipientIdentity: string; text: string };

export function InboxPanel() {
  const getConversations = useMessagesStore((s) => s.getConversations);
  const myIdentity = useMessagesStore((s) => s.myIdentity);
  const [activeThread, setActiveThread] = useState<{ identity: string; name: string } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newMsg, setNewMsg] = useState<NewMessageState>({ recipientIdentity: "", text: "" });
  const [sending, setSending] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  const conversations = getConversations();

  const handleSendNew = () => {
    const conn = getConnection();
    if (!conn) return;
    const identity = newMsg.recipientIdentity.trim();
    const text = newMsg.text.trim();
    if (!identity || !text) return;

    setSending(true);
    setNewError(null);
    try {
      conn.reducers.sendMessage({ recipientIdentity: identity, text });
      setNewMsg({ recipientIdentity: "", text: "" });
      setShowNew(false);
    } catch {
      setNewError("Could not send message.");
    } finally {
      setSending(false);
    }
  };

  if (activeThread) {
    return (
      <MessageThread
        otherIdentity={activeThread.identity}
        otherName={activeThread.name}
        onBack={() => setActiveThread(null)}
      />
    );
  }

  if (showNew) {
    return (
      <div className="flex w-80 flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-foreground">New Message</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { setShowNew(false); setNewError(null); }}
          >
            Cancel
          </Button>
        </div>
        <Separator className="opacity-30" />
        <div className="flex flex-col gap-3 px-4 py-3">
          <input
            type="text"
            placeholder="Recipient identity (hex)"
            value={newMsg.recipientIdentity}
            onChange={(e) => setNewMsg((m) => ({ ...m, recipientIdentity: e.target.value }))}
            className="rounded-lg border border-border/40 bg-accent/5 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
          <textarea
            placeholder="Message…"
            value={newMsg.text}
            onChange={(e) => setNewMsg((m) => ({ ...m, text: e.target.value }))}
            rows={3}
            className="resize-none rounded-lg border border-border/40 bg-accent/5 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
          {newError && <p className="text-[11px] text-red-500">{newError}</p>}
          <Button
            size="sm"
            className="bg-accent text-white hover:bg-accent/80"
            onClick={handleSendNew}
            disabled={!newMsg.recipientIdentity.trim() || !newMsg.text.trim() || sending}
          >
            Send
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-80 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Messages</span>
        {myIdentity && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setShowNew(true)}
            title="New message"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        )}
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
              <button
                key={conv.otherIdentity}
                onClick={() =>
                  setActiveThread({ identity: conv.otherIdentity, name: conv.otherName })
                }
                className={`flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/5 ${
                  conv.unreadCount > 0 ? "bg-accent/6" : ""
                }`}
              >
                {/* Unread indicator */}
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
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
