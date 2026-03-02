"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
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
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/account">
              <UserRound />
              Account
            </Link>
          </DropdownMenuItem>
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
