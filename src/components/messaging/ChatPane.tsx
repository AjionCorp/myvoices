"use client";

import { useRef, useEffect, useState } from "react";
import { Send, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessagesStore, type DirectMessage } from "@/stores/messages-store";
import { getConnection } from "@/lib/spacetimedb/client";
import { MessageRequestCard } from "./MessageRequestCard";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts / 1000) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sizeClass = size === "md" ? "h-10 w-10 text-sm" : "h-7 w-7 text-[10px]";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent/20 font-semibold text-accent ${sizeClass}`}
    >
      {initials}
    </div>
  );
}

interface Props {
  otherIdentity: string;
  otherName: string;
  conversationId: number;
  conversationStatus: "active" | "request_pending" | "request_declined";
  requestRecipient: string;
  onBack?: () => void;
}

export function ChatPane({
  otherIdentity,
  otherName,
  conversationId,
  conversationStatus,
  requestRecipient,
  onBack,
}: Props) {
  const getConversation = useMessagesStore((s) => s.getConversation);
  const myIdentity = useMessagesStore((s) => s.myIdentity);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = getConversation(otherIdentity);
  const isRequest = conversationStatus === "request_pending";
  const isMyRequest = isRequest && requestRecipient === myIdentity;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark messages as read when viewing
  useEffect(() => {
    const conn = getConnection();
    if (!conn || !otherIdentity) return;
    conn.reducers.markAllMessagesRead({ otherIdentity });
  }, [otherIdentity, messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const conn = getConnection();
    if (!conn) return;
    setSending(true);
    try {
      conn.reducers.sendMessage({ recipientIdentity: otherIdentity, text: trimmed });
      setText("");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/30 px-4 py-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Avatar name={otherName} size="md" />
        <div>
          <p className="text-sm font-semibold text-foreground">{otherName}</p>
          <p className="text-xs text-muted-foreground">@{otherName}</p>
        </div>
      </div>

      {/* Message Request Banner */}
      {isMyRequest && (
        <MessageRequestCard
          conversationId={conversationId}
          senderName={otherName}
        />
      )}

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 px-4 py-4">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No messages yet. Say hello!
            </p>
          ) : (
            messages.map((msg: DirectMessage) => {
              const isMine = msg.senderIdentity === myIdentity;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isMine
                        ? "rounded-br-md bg-accent text-white"
                        : "rounded-bl-md bg-accent/10 text-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="px-1 text-[10px] text-muted-foreground">
                    {timeAgo(msg.createdAt)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input — hidden for requests the user hasn't accepted yet */}
      {!isMyRequest && (
        <div className="flex items-end gap-2 border-t border-border/30 px-4 py-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start a new message"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border/40 bg-accent/5 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
            style={{ maxHeight: "120px", overflowY: "auto" }}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full bg-accent text-white hover:bg-accent/80"
            onClick={handleSend}
            disabled={!text.trim() || sending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/** Empty state when no conversation is selected */
export function ChatPaneEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
        <Mail className="h-8 w-8 text-accent/60" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">Select a message</h3>
      <p className="max-w-xs text-sm text-muted-foreground">
        Choose from your existing conversations, start a new one, or just keep swimming.
      </p>
    </div>
  );
}
