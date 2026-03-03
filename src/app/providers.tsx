"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SpacetimeDBProvider } from "@/components/spacetimedb/SpacetimeDBProvider";
import { MockDataLoader } from "@/components/dev/MockDataLoader";

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      appearance={{ layout: { unsafe_disableDevelopmentModeWarnings: true } }}
    >
      <AuthProvider>
        <SpacetimeDBProvider>
          {USE_MOCK && <MockDataLoader />}
          {children}
        </SpacetimeDBProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}
