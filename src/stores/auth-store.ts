import { create } from "zustand";

export interface User {
  identity: string;
  clerkUserId: string | null;
  username: string | null;
  displayName: string;
  email: string | null;
  stripeAccountId: string | null;
  totalEarnings: number;
  isAdmin: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** The Clerk user ID (e.g. user_2abc...). Stored separately so it is never
   *  overwritten when SpacetimeDBProvider sets the real SpacetimeDB hex identity. */
  clerkUserId: string | null;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setClerkUserId: (id: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  clerkUserId: null,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  setToken: (token) => set({ token }),

  setLoading: (loading) => set({ isLoading: loading }),

  setClerkUserId: (clerkUserId) => set({ clerkUserId }),

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("spacetimedb_user");
    }
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      clerkUserId: null,
    });
  },
}));
