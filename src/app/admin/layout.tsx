"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const navItems = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/taxonomy", label: "Taxonomy" },
  { href: "/admin/ads", label: "Ads" },
  { href: "/admin/contests", label: "Contests" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/reports", label: "Reports" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user?.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Card className="gap-0 rounded-2xl border-border bg-surface py-0 text-center">
          <CardContent className="p-8">
          <h1 className="mb-2 text-xl font-semibold text-foreground">
            Admin Access Required
          </h1>
          <p className="mb-4 text-sm text-muted">
            You need admin privileges to access this area.
          </p>
          <Button asChild className="rounded-lg">
            <Link href="/">Back to Canvas</Link>
          </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed left-0 top-0 flex h-full w-56 flex-col border-r border-border bg-surface">
        <div className="border-b border-border p-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
              mV
            </div>
            <span className="font-semibold text-foreground">Admin</span>
          </Link>
        </div>

        <nav className="flex-1 p-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-1 flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-accent/10 font-medium text-accent-light"
                    : "text-muted hover:bg-surface-light hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {user.displayName}
              </p>
            <Badge variant="outline" className="truncate text-xs text-muted">Admin</Badge>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-56 flex-1 p-8">{children}</main>
    </div>
  );
}
