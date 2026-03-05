"use client";

import { useState } from "react";
import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserSearchInput } from "./UserSearchInput";
import { getConnection } from "@/lib/spacetimedb/client";

interface Props {
  onClose: () => void;
  onSent?: (recipientIdentity: string) => void;
}

export function NewMessageDialog({ onClose, onSent }: Props) {
  const [selectedUser, setSelectedUser] = useState<{
    identity: string;
    username: string;
    displayName: string;
  } | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = () => {
    if (!selectedUser || !text.trim() || sending) return;
    const conn = getConnection();
    if (!conn) return;

    setSending(true);
    setError(null);
    try {
      conn.reducers.sendMessage({
        recipientIdentity: selectedUser.identity,
        text: text.trim(),
      });
      onSent?.(selectedUser.identity);
      onClose();
    } catch {
      setError("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl border border-border/40 bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">New message</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="border-b border-border/30 px-4 py-3">
          {selectedUser ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">To:</span>
              <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-sm text-foreground">
                {selectedUser.displayName}
                <button
                  onClick={() => setSelectedUser(null)}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          ) : (
            <UserSearchInput
              onSelect={setSelectedUser}
              placeholder="Search for a person"
            />
          )}
        </div>

        {/* Compose */}
        <div className="px-4 py-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start a new message"
            rows={4}
            className="w-full resize-none rounded-lg border border-border/40 bg-accent/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border/30 px-4 py-3">
          <Button
            size="sm"
            className="gap-1.5 bg-accent text-white hover:bg-accent/80"
            onClick={handleSend}
            disabled={!selectedUser || !text.trim() || sending}
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
