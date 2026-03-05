"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getConnection } from "@/lib/spacetimedb/client";

interface Props {
  conversationId: number;
  senderName: string;
  onAccepted?: () => void;
  onDeclined?: () => void;
}

export function MessageRequestCard({
  conversationId,
  senderName,
  onAccepted,
  onDeclined,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleAccept = () => {
    const conn = getConnection();
    if (!conn) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (conn.reducers as any).acceptMessageRequest({ conversationId });
      onAccepted?.();
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    const conn = getConnection();
    if (!conn) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (conn.reducers as any).declineMessageRequest({ conversationId });
      onDeclined?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-3 mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {senderName} wants to send you a message
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            They don&apos;t follow you. Accept to move this to your inbox.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              className="h-7 bg-accent text-white hover:bg-accent/80"
              onClick={handleAccept}
              disabled={loading}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-muted-foreground hover:text-foreground"
              onClick={handleDecline}
              disabled={loading}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
