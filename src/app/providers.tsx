"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SpacetimeDBProvider } from "@/components/spacetimedb/SpacetimeDBProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SpacetimeDBProvider>
      <AuthProvider>{children}</AuthProvider>
    </SpacetimeDBProvider>
  );
}
