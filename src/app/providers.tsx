"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SpacetimeDBProvider } from "@/components/spacetimedb/SpacetimeDBProvider";

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <AuthProvider>
        <SpacetimeDBProvider>{children}</SpacetimeDBProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}
