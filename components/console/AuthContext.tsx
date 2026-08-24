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
  /**
   * Stable id derived from email (SHA-256 hex, `eu_` prefix).
   * Used as PymtHouse `externalUserId` — never the raw email (SDK forbids @).
   */
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
  connect: (user: Omit<MockUser, "id">) => Promise<void>;
  updateUser: (patch: Partial<Omit<MockUser, "id">>) => Promise<void>;
  disconnect: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  isConnected: false,
  isLoading: true,
  user: null,
  connect: async () => {},
  updateUser: async () => {},
  disconnect: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const USER_SESSION_KEY = "console-user";
/** Legacy keys from the dashboard rename / machine-id identity; migrated or cleared on load. */
const LEGACY_USER_SESSION_KEY = "dashboard-user";
const LEGACY_MACHINE_ID_KEY = "dashboard-machine-id";

/**
 * Deterministic PymtHouse externalUserId from email.
 * Must match builder-sdk: no `@`, no `owner:`/`user:` prefix, charset [A-Za-z0-9._:-].
 */
export async function externalUserIdFromEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase() || "demo@livepeer.org";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`livepeer-dashboard:externalUserId:${normalized}`),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `eu_${hex}`;
}

async function hydrateMockUser(
  parsed: Partial<MockUser> & Pick<MockUser, "email">,
): Promise<MockUser> {
  const email = parsed.email?.trim() || "demo@livepeer.org";
  return {
    id: await externalUserIdFromEmail(email),
    name: parsed.name ?? "Demo User",
    email,
    initials: parsed.initials ?? "DU",
    provider: (parsed.provider as AuthProvider) ?? "email",
    avatarUrl: parsed.avatarUrl,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<MockUser | null>(null);

  // Restore from localStorage; re-derive id from email so prior UUID sessions migrate.
  useEffect(() => {
    if (typeof window === "undefined") return;

    localStorage.removeItem(LEGACY_MACHINE_ID_KEY);

    void (async () => {
      const stored =
        localStorage.getItem(USER_SESSION_KEY) ??
        localStorage.getItem(LEGACY_USER_SESSION_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<MockUser>;
          if (parsed.email) {
            const hydrated = await hydrateMockUser({
              ...parsed,
              email: parsed.email,
            });
            setUser(hydrated);
            setIsConnected(true);
            localStorage.setItem(USER_SESSION_KEY, JSON.stringify(hydrated));
            localStorage.removeItem(LEGACY_USER_SESSION_KEY);
          }
        } catch {
          // ignore
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const connect = async (u: Omit<MockUser, "id">) => {
    const next = await hydrateMockUser(u);
    setUser(next);
    setIsConnected(true);
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(next));
    localStorage.removeItem(LEGACY_USER_SESSION_KEY);
  };

  const updateUser = async (patch: Partial<Omit<MockUser, "id">>) => {
    const prev = user;
    if (!prev) return;
    const next = await hydrateMockUser({ ...prev, ...patch });
    setUser(next);
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(next));
  };

  const disconnect = () => {
    setUser(null);
    setIsConnected(false);
    localStorage.removeItem(USER_SESSION_KEY);
    localStorage.removeItem(LEGACY_USER_SESSION_KEY);
    localStorage.removeItem(LEGACY_MACHINE_ID_KEY);
  };

  return (
    <AuthContext.Provider
      value={{ isConnected, isLoading, user, connect, updateUser, disconnect }}
    >
      {children}
    </AuthContext.Provider>
  );
}
