"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Menu } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { InboxButton } from "@/components/messaging/InboxButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { useContestStore } from "@/stores/contest-store";
import { useCanvasStore } from "@/stores/canvas-store";
import { useTopicStore } from "@/stores/topic-store";
import { useExploreStore } from "@/stores/explore-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, isAuthenticated } = useAuth();
  const { activeContest, timeRemaining } = useContestStore();
  const openAddVideoModal = useCanvasStore((s) => s.openAddVideoModal);
  const activeTopic = useTopicStore((s) => s.activeTopic);
  const toggleSidebar = useExploreStore((s) => s.toggleSidebar);
  const pathname = usePathname();
  const isHome = pathname === "/";

  const formatTime = (ms: number | null): string => {
    if (!ms || ms <= 0) return "Ended";
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-5 py-4 sm:px-8">
        {/* Left: hamburger + logo + badge */}
        <div className="flex items-center gap-4">
          {isHome && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 text-foreground hover:bg-accent/20"
              title="Explore Universe"
              aria-label="Open explore sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white shadow-sm shadow-accent/30">
              mV
            </div>
            <span className="text-[17px] font-bold tracking-tight text-foreground">myVoice</span>
          </Link>

          {activeContest && (
            <Badge variant="outline" className="hidden items-center gap-1.5 border-primary/40 bg-primary/10 text-primary sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-light" />
              {formatTime(timeRemaining)} left
            </Badge>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated && isHome && (
            <Button asChild variant="ghost" size="sm" className="text-foreground hover:bg-accent/20">
              <Link href="/t/create" title="Create Topic" className="flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                <span>Create</span>
              </Link>
            </Button>
          )}
          {isAuthenticated && activeTopic && (
            <Button
              onClick={openAddVideoModal}
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-accent/20"
              title="Add Video"
            >
              <Plus />
            </Button>
          )}
          {user?.isAdmin && (
            <Button asChild variant="outline" size="sm" className="text-muted hover:text-foreground">
              <Link href="/admin">Admin</Link>
            </Button>
          )}
          {isAuthenticated && <NotificationBell />}
          {isAuthenticated && <InboxButton />}
          <LoginButton />
        </div>
      </div>
    </header>
  );
}
