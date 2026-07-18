"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export type AuthProvider = "github" | "google" | "email";

export interface MockUser {
  /** Persistent machine id used as PymtHouse `externalUserId` (never email). */
  id: string;
  name: string;
  email: string;
  initials: string;
  provider: AuthProvider;
  avatarUrl?: string;
}

interface AuthContextValue {
  isConnected: boolean;
  isLoading: boolean;
  user: MockUser | null;
  connect: (user: Omit<MockUser, "id"> & { id?: string }) => void;
  updateUser: (patch: Partial<MockUser>) => void;
  disconnect: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  isConnected: false,
  isLoading: true,
  user: null,
  connect: () => {},
  updateUser: () => {},
  disconnect: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function newMachineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function hydrateMockUser(parsed: Partial<MockUser>): MockUser {
  return {
    id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id.trim() : newMachineId(),
    name: parsed.name ?? "Demo User",
    email: parsed.email ?? "demo@livepeer.org",
    initials: parsed.initials ?? "DU",
    provider: (parsed.provider as AuthProvider) ?? "email",
    avatarUrl: parsed.avatarUrl,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<MockUser | null>(null);

  // Restore from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dashboard-user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<MockUser>;
          // Backfill provider + machine id for pre-existing localStorage entries
          const hydrated = hydrateMockUser(parsed);
          setUser(hydrated);
          setIsConnected(true);
          localStorage.setItem("dashboard-user", JSON.stringify(hydrated));
        } catch {
          // ignore
        }
      }
      setIsLoading(false);
    }
  }, []);

  const connect = (u: Omit<MockUser, "id"> & { id?: string }) => {
    const next = hydrateMockUser(u);
    setUser(next);
    setIsConnected(true);
    localStorage.setItem("dashboard-user", JSON.stringify(next));
  };

  const updateUser = (patch: Partial<MockUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = hydrateMockUser({ ...prev, ...patch });
      localStorage.setItem("dashboard-user", JSON.stringify(next));
      return next;
    });
  };

  const disconnect = () => {
    setUser(null);
    setIsConnected(false);
    localStorage.removeItem("dashboard-user");
  };

  return (
    <AuthContext.Provider
      value={{ isConnected, isLoading, user, connect, updateUser, disconnect }}
    >
      {children}
    </AuthContext.Provider>
  );
}
