"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { useAuthStore, type User } from "@/stores/auth-store";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const ISSUER = process.env.NEXT_PUBLIC_SPACETIMEAUTH_ISSUER || "";
const CLIENT_ID = process.env.NEXT_PUBLIC_SPACETIMEAUTH_CLIENT_ID || "";
const REDIRECT_URI = process.env.NEXT_PUBLIC_SPACETIMEAUTH_REDIRECT_URI || "";

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, setUser, setToken, setLoading, logout: storeLogout } =
    useAuthStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("spacetimedb_token");
    const storedUser = localStorage.getItem("spacetimedb_user");

    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsed);
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
    setInitialized(true);
  }, [setToken, setUser, setLoading]);

  const login = useCallback(async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    sessionStorage.setItem("pkce_verifier", verifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid profile email",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: crypto.randomUUID(),
    });

    window.location.href = `${ISSUER}/authorize?${params}`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("spacetimedb_user");
    storeLogout();
  }, [storeLogout]);

  if (!initialized) return null;

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
