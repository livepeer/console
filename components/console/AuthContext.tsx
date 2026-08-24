"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useUser } from "@auth0/nextjs-auth0/client";

export type AuthProvider = "github" | "google" | "email";

export interface ConsoleUser {
  name: string;
  email: string;
  initials: string;
  provider: AuthProvider;
  avatarUrl?: string;
}

interface AuthContextValue {
  isConnected: boolean;
  isLoading: boolean;
  user: ConsoleUser | null;
  disconnect: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  isConnected: false,
  isLoading: true,
  user: null,
  disconnect: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function displayNameFrom(email: string, preferredName?: string): string {
  const trimmed = preferredName?.trim();
  if (trimmed) return trimmed;
  return email.split("@")[0] || "User";
}

function providerFromSub(sub?: string): AuthProvider {
  if (sub?.startsWith("github|")) return "github";
  if (sub?.startsWith("google-oauth2|")) return "google";
  return "email";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: auth0User, isLoading } = useUser();

  const user = useMemo<ConsoleUser | null>(() => {
    if (!auth0User) return null;
    const email = auth0User.email?.trim() || "";
    const name = displayNameFrom(
      email,
      auth0User.name?.trim() || auth0User.nickname?.trim(),
    );
    return {
      name,
      email,
      initials: getInitials(name) || "U",
      provider: providerFromSub(auth0User.sub),
      avatarUrl: auth0User.picture,
    };
  }, [auth0User]);

  const disconnect = useCallback(() => {
    window.location.assign("/auth/logout");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isConnected: !!auth0User,
        isLoading,
        user,
        disconnect,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
