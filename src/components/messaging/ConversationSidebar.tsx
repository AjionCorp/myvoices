"use client";

import { useState } from "react";
import { Edit2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useMessagesStore } from "@/stores/messages-store";
import { useModerationStore } from "@/stores/moderation-store";
import { ConversationItem } from "./ConversationItem";

interface Props {
  selectedConversationIdentity: string | null;
  onSelectConversation: (otherIdentity: string, conversationId: number) => void;
  onNewMessage: () => void;
}

export function ConversationSidebar({
  selectedConversationIdentity,
  onSelectConversation,
  onNewMessage,
}: Props) {
  const activeTab = useMessagesStore((s) => s.activeTab);
  const setActiveTab = useMessagesStore((s) => s.setActiveTab);
  const getPrimaryConversations = useMessagesStore((s) => s.getPrimaryConversations);
  const getRequestConversations = useMessagesStore((s) => s.getRequestConversations);
  const requestCount = useMessagesStore((s) => s.requestCount);
  const myIdentity = useMessagesStore((s) => s.myIdentity);
  const [search, setSearch] = useState("");

  const blockedIds = useModerationStore(
    (s) => (myIdentity ? s.getHiddenIdentities(myIdentity) : new Set<string>())
  );

  const conversations = (
    activeTab === "primary" ? getPrimaryConversations() : getRequestConversations()
  ).filter((c) => !blockedIds.has(c.otherIdentity));

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.otherName.toLowerCase().includes(search.toLowerCase()) ||
        c.otherIdentity.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  return (
    <div className="flex h-full flex-col border-r border-border/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-bold text-foreground">Messages</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onNewMessage}
          title="New message"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 rounded-full border border-border/40 bg-accent/5 px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Direct Messages"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/30">
        <button
          onClick={() => setActiveTab("primary")}
          className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors ${
            activeTab === "primary"
              ? "border-b-2 border-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Primary
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors ${
            activeTab === "requests"
              ? "border-b-2 border-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Requests
          {requestCount > 0 && (
            <Badge className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
              {requestCount}
            </Badge>
          )}
        </button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {activeTab === "requests"
                ? "No message requests"
                : search.trim()
                  ? "No results"
                  : "No messages yet"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.otherIdentity}
                conversation={conv}
                isSelected={conv.otherIdentity === selectedConversationIdentity}
                myIdentity={myIdentity || ""}
                onClick={() => onSelectConversation(conv.otherIdentity, conv.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
