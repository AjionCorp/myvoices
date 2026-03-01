"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { useAuth as useClerkAuth, useUser, useClerk } from "@clerk/nextjs";
import { useAuthStore, type User } from "@/stores/auth-store";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Clerk session JWT — passed to SpacetimeDB as the bearer token */
  oidcToken: string | null;
  login: () => void;
  loginWithPopup: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  oidcToken: null,
  login: () => {},
  loginWithPopup: async () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { openSignIn, openSignUp, signOut } = useClerk();
  const { user, isAuthenticated, isLoading, setUser, setToken, setLoading, setClerkUserId, logout: storeLogout } =
    useAuthStore();
  const [oidcToken, setOidcToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !clerkUser) {
      setLoading(false);
      setOidcToken(null);
      return;
    }

    // Build user from Clerk profile — isAdmin / stripeAccountId get overwritten by
    // SpacetimeDBProvider.onConnect once the WebSocket connection is established.
    // Try every available email source — primaryEmailAddress may be null if Clerk
    // hasn't hydrated it yet or the user signed up via OAuth without a primary email.
    const clerkEmail =
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses?.[0]?.emailAddress ??
      null;
    const clerkDisplayName =
      clerkUser.fullName ||
      clerkUser.username ||
      clerkEmail ||
      "User";

    setClerkUserId(clerkUser.id);

    const clerkUsername = clerkUser.username ?? null;

    console.log("[Auth] Clerk data:", {
      email: clerkEmail ?? "(null)",
      username: clerkUsername ?? "(null)",
      displayName: clerkDisplayName,
      primaryEmail: clerkUser.primaryEmailAddress?.emailAddress ?? "(null)",
      emailAddresses: clerkUser.emailAddresses?.map((e) => e.emailAddress) ?? [],
    });

    const storedUser = typeof window !== "undefined" ? localStorage.getItem("spacetimedb_user") : null;
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        // Always freshen email, username + displayName from Clerk so stale localStorage
        // entries never cause blank values to be passed to registerUser.
        const userData = {
          ...parsed,
          clerkUserId: clerkUser.id,
          username: clerkUsername ?? parsed.username ?? null,
          email: clerkEmail ?? parsed.email ?? null,
          displayName: parsed.displayName || clerkDisplayName,
        };
        console.log("[Auth] setUser (from stored + Clerk):", { email: userData.email ?? "(null)", username: userData.username ?? "(null)", displayName: userData.displayName });
        setUser(userData);
      } catch { /* ignore corrupt entry */ }
    } else {
      const userData = {
        identity: clerkUser.id,
        clerkUserId: clerkUser.id,
        username: clerkUsername,
        displayName: clerkDisplayName,
        email: clerkEmail,
        stripeAccountId: null,
        totalEarnings: 0,
        isAdmin: false,
      };
      console.log("[Auth] setUser (new):", { email: userData.email ?? "(null)", username: userData.username ?? "(null)", displayName: userData.displayName });
      setUser(userData);
    }

    // Fetch Clerk JWT using the "spacetimedb" template so SpacetimeDB can validate it
    getToken({ template: "spacetimedb" })
      .then((t) => {
        console.log("[Auth] getToken result:", t ? "got token" : "null (JWT template missing or not configured?)");
        setOidcToken(t);
        if (t) setToken(t);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[Auth] getToken failed:", err);
        setLoading(false);
      });
  // Include primaryEmailAddress in deps so the effect re-runs if Clerk hydrates
  // the email after the initial user object is available (lazy loading).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, clerkUser?.id, clerkUser?.primaryEmailAddress?.emailAddress]);

  const login = useCallback(() => openSignIn(), [openSignIn]);

  const loginWithPopup = useCallback(async () => {
    openSignIn();
  }, [openSignIn]);

  const loginSignUp = useCallback(() => openSignUp(), [openSignUp]);

  const logout = useCallback(async () => {
    storeLogout();
    setOidcToken(null);
    await signOut();
  }, [signOut, storeLogout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        oidcToken,
        login,
        loginWithPopup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthBridge>{children}</AuthBridge>;
}

/** Expose openSignUp separately for components that need it */
export function useSignUp() {
  const { openSignUp } = useClerk();
  return useCallback(() => openSignUp(), [openSignUp]);
}
