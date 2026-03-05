"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMessagesStore } from "@/stores/messages-store";

export function InboxButton() {
  const totalUnread = useMessagesStore((s) => s.totalUnread);
  const requestCount = useMessagesStore((s) => s.requestCount);
  const total = totalUnread + requestCount;

  return (
    <Link
      href="/messages"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent/20"
      aria-label="Messages"
    >
      <Mail className="h-[18px] w-[18px]" />
      {total > 0 && (
        <Badge className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 py-0 text-[9px] font-bold leading-none text-white">
          {total > 99 ? "99+" : total}
        </Badge>
      )}
    </Link>
  );
}
