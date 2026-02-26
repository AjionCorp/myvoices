import { create } from "zustand";

export interface User {
  identity: string;
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

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  setToken: (token) => set({ token }),

  setLoading: (loading) => set({ isLoading: loading }),

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("spacetimedb_token");
    }
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));
