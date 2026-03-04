"use client";

import { useRef, useEffect, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useMessagesStore, type DirectMessage } from "@/stores/messages-store";
import { getConnection } from "@/lib/spacetimedb/client";

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
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold text-accent">
      {initials}
    </div>
  );
}

interface Props {
  otherIdentity: string;
  otherName: string;
  onBack: () => void;
}

export function MessageThread({ otherIdentity, otherName, onBack }: Props) {
  const getConversation = useMessagesStore((s) => s.getConversation);
  const myIdentity = useMessagesStore((s) => s.myIdentity);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = getConversation(otherIdentity);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const conn = getConnection();
    if (!conn || !otherIdentity) return;
    conn.reducers.markAllMessagesRead({ otherIdentity });
  }, [otherIdentity]);

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
    <div className="flex w-80 flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar name={otherName} />
        <span className="truncate text-sm font-semibold text-foreground">{otherName}</span>
      </div>

      <Separator className="opacity-30" />

      {/* Messages */}
      <ScrollArea className="h-72">
        <div className="flex flex-col gap-2 px-3 py-3">
          {messages.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
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
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                      isMine
                        ? "rounded-br-sm bg-accent text-white"
                        : "rounded-bl-sm bg-accent/10 text-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(msg.createdAt)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <Separator className="opacity-30" />

      {/* Input */}
      <div className="flex items-end gap-2 px-3 py-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border/40 bg-accent/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
          style={{ maxHeight: "80px", overflowY: "auto" }}
        />
        <Button
          size="icon"
          className="h-8 w-8 shrink-0 bg-accent text-white hover:bg-accent/80"
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
