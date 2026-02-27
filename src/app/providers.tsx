"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SpacetimeDBProvider } from "@/components/spacetimedb/SpacetimeDBProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SpacetimeDBProvider>{children}</SpacetimeDBProvider>
    </AuthProvider>
  );
}
