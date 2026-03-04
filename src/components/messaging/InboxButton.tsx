"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMessagesStore } from "@/stores/messages-store";
import { InboxPanel } from "./InboxPanel";

export function InboxButton() {
  const totalUnread = useMessagesStore((s) => s.totalUnread);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-foreground hover:bg-accent/20"
          aria-label="Messages"
        >
          <Mail className="h-[18px] w-[18px]" />
          {totalUnread > 0 && (
            <Badge
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 py-0 text-[9px] font-bold leading-none text-white"
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 shadow-xl"
      >
        <InboxPanel />
      </PopoverContent>
    </Popover>
  );
}
