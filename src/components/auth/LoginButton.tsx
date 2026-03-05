"use client";

import Image from "next/image";
import Link from "next/link";
import { Bookmark, ChevronDown, Coins, Heart, LogOut, Settings, UserRound, Wallet } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LoginButton() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-surface-light" />;
  }

  if (isAuthenticated && user) {
    const initials = (user.username || user.displayName).charAt(0).toUpperCase();
    const formattedCredits = new Intl.NumberFormat().format(user.credits ?? 0);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto rounded-full p-0 hover:bg-transparent">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-bold text-white ring-2 ring-border">
            {user.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt={user.username || user.displayName}
                fill
                sizes="36px"
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              initials
            )}
          </div>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {user.username || user.displayName}
          </span>
          <ChevronDown className="hidden size-4 text-muted sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="truncate">
            {user.username || user.displayName}
          </DropdownMenuLabel>
          <DropdownMenuLabel className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
            <span className="flex items-center gap-1.5">
              <Coins className="size-3.5 text-accent" />
              Credits
            </span>
            <span className="text-foreground">{formattedCredits}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/u/${user.username}`}>
              <UserRound />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/liked">
              <Heart />
              Liked
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/saved">
              <Bookmark />
              Saved
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/earnings">
              <Wallet />
              Earnings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={logout}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      onClick={login}
      variant="default"
      className="rounded-lg"
    >
      Sign In
    </Button>
  );
}
