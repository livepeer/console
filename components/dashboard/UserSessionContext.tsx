"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/dashboard/AuthContext";
import {
  useSigningSession,
  type SigningSessionState,
} from "@/lib/dashboard/useSigningSession";

export type UserSessionContextValue = {
  /** PymtHouse short-lived signing JWT for the signed-in user. */
  signing: SigningSessionState;
  refreshSigningToken: () => Promise<void>;
  ensureSigningAccessToken: () => Promise<string>;
  clearSigningSession: () => void;
};

const UserSessionContext = createContext<UserSessionContextValue>({
  signing: { status: "idle" },
  refreshSigningToken: async () => {},
  ensureSigningAccessToken: async () => "",
  clearSigningSession: () => {},
});

export function useUserSession() {
  return useContext(UserSessionContext);
}

/** @deprecated Use `useUserSession` */
export function useSignerSession() {
  const session = useUserSession();
  return {
    enabled: session.signing.status !== "idle",
    state: session.signing,
    refresh: session.refreshSigningToken,
    ensureAccessToken: session.ensureSigningAccessToken,
    clearSession: session.clearSigningSession,
  };
}

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const { user, isConnected } = useAuth();
  const externalUserId = user?.email?.trim();
  const mintEnabled = isConnected && Boolean(externalUserId);

  const { state, refresh, ensureAccessToken, clearSession } = useSigningSession(
    mintEnabled,
    externalUserId,
  );

  useEffect(() => {
    if (!mintEnabled) {
      clearSession();
    }
  }, [mintEnabled, clearSession]);

  return (
    <UserSessionContext.Provider
      value={{
        signing: state,
        refreshSigningToken: refresh,
        ensureSigningAccessToken: ensureAccessToken,
        clearSigningSession: clearSession,
      }}
    >
      {children}
    </UserSessionContext.Provider>
  );
}

/** @deprecated Use `UserSessionProvider` */
export const SignerSessionProvider = UserSessionProvider;
