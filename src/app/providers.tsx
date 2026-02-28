"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SpacetimeDBProvider } from "@/components/spacetimedb/SpacetimeDBProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <AuthProvider>
        <SpacetimeDBProvider>{children}</SpacetimeDBProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}
