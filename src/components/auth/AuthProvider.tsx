"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { AuthProvider as OidcAuthProvider, useAuth as useOidcAuth } from "react-oidc-context";
import { useAuthStore, type User } from "@/stores/auth-store";
import type { WebStorageStateStore } from "oidc-client-ts";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  oidcToken: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  oidcToken: null,
  login: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const AUTHORITY = process.env.NEXT_PUBLIC_SPACETIMEAUTH_ISSUER || "https://auth.spacetimedb.com/oidc";
const CLIENT_ID = process.env.NEXT_PUBLIC_SPACETIMEAUTH_CLIENT_ID || "";
const REDIRECT_URI = process.env.NEXT_PUBLIC_SPACETIMEAUTH_REDIRECT_URI || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

function AuthBridge({ children }: { children: ReactNode }) {
  const oidc = useOidcAuth();
  const { user, isAuthenticated, isLoading, setUser, setToken, setLoading, logout: storeLogout } =
    useAuthStore();

  useEffect(() => {
    if (oidc.isLoading) return;

    if (oidc.isAuthenticated && oidc.user?.id_token) {
      setToken(oidc.user.id_token);
      localStorage.setItem("spacetimedb_token", oidc.user.id_token);

      const profile = oidc.user.profile;
      const storedUser = localStorage.getItem("spacetimedb_user");
      try {
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          setUser({
            identity: profile?.sub ?? "",
            displayName: profile?.preferred_username || profile?.name || profile?.email || "User",
            email: profile?.email || null,
            stripeAccountId: null,
            totalEarnings: 0,
            isAdmin: false,
          });
        }
      } finally {
        setLoading(false);
      }
    } else {
      const storedToken = localStorage.getItem("spacetimedb_token");
      const storedUser = localStorage.getItem("spacetimedb_user");
      if (storedToken && storedUser) {
        try {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        } catch {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
  }, [oidc.isLoading, oidc.isAuthenticated, oidc.user, setToken, setUser, setLoading]);

  const login = useCallback(() => {
    oidc.signinRedirect();
  }, [oidc]);

  const logout = useCallback(() => {
    localStorage.removeItem("spacetimedb_user");
    localStorage.removeItem("spacetimedb_token");
    storeLogout();
    oidc.signoutRedirect().catch(() => {
      oidc.removeUser();
    });
  }, [oidc, storeLogout]);

  const oidcToken = oidc.user?.id_token || null;

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, oidcToken, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function onSigninCallback() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!CLIENT_ID) {
    return (
      <AuthBridgeFallback>{children}</AuthBridgeFallback>
    );
  }

  const oidcConfig = {
    authority: AUTHORITY,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    post_logout_redirect_uri: typeof window !== "undefined" ? window.location.origin : "",
    scope: "openid profile email",
    response_type: "code",
    automaticSilentRenew: true,
    onSigninCallback,
  };

  return (
    <OidcAuthProvider {...oidcConfig}>
      <AuthBridge>{children}</AuthBridge>
    </OidcAuthProvider>
  );
}

function AuthBridgeFallback({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, setUser, setToken, setLoading, logout: storeLogout } =
    useAuthStore();

  useEffect(() => {
    const storedToken = localStorage.getItem("spacetimedb_token");
    const storedUser = localStorage.getItem("spacetimedb_user");
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [setToken, setUser, setLoading]);

  const logout = useCallback(() => {
    localStorage.removeItem("spacetimedb_user");
    localStorage.removeItem("spacetimedb_token");
    storeLogout();
  }, [storeLogout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        oidcToken: null,
        login: () => console.warn("No OIDC client configured. Set NEXT_PUBLIC_SPACETIMEAUTH_CLIENT_ID."),
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
