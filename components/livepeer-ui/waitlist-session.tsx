"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  captureEvent,
  identifyMember,
  resetAnalyticsIdentity,
} from "@/lib/analytics";
import type { WaitlistSessionResponse } from "@/lib/waitlist/contracts";
import { buildWaitlistJoinHref } from "./waitlist-auth-navigation";

type WaitlistState =
  | { status: "signed-out" }
  | { status: "signed-in"; data: WaitlistSessionResponse }
  | { status: "error"; message: string };

type WaitlistContextValue = {
  state: WaitlistState;
  joinHref: string;
  onAuthStart: () => void;
  onSignOut: () => void;
  updateNewsletterConsent: (subscribed: boolean) => Promise<void>;
  consentSaving: boolean;
  consentError: string | null;
};
const WaitlistContext = createContext<WaitlistContextValue | null>(null);

export function WaitlistSessionProvider({
  children,
  initialSession,
  initialJoinHref,
}: {
  children: ReactNode;
  initialSession: WaitlistSessionResponse | null;
  initialJoinHref?: string;
}) {
  const [state, setState] = useState<WaitlistState>(() =>
    initialSession
      ? { status: "signed-in", data: initialSession }
      : { status: "signed-out" }
  );
  const [joinHref, setJoinHref] = useState(
    initialJoinHref ?? buildWaitlistJoinHref(new URLSearchParams())
  );
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const identifiedMemberRef = useRef<string | null>(null);
  const sessionRequestRef = useRef(0);
  const consentLock = useRef(false);

  const loadSession = useCallback(async () => {
    const request = ++sessionRequestRef.current;
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      if (request !== sessionRequestRef.current) return;
      if (response.status === 401) {
        setState({ status: "signed-out" });
        return;
      }
      const result = (await response.json()) as WaitlistSessionResponse;
      if (!response.ok || !result?.member)
        throw new Error(
          "Couldn’t load your waitlist membership. Please try again."
        );
      if (request === sessionRequestRef.current)
        setState({ status: "signed-in", data: result });
    } catch {
      if (request === sessionRequestRef.current)
        setState({
          status: "error",
          message:
            "Couldn’t load your waitlist membership. Please sign in or try again.",
        });
    }
  }, []);

  const cancelPendingSession = useCallback(() => {
    sessionRequestRef.current++;
  }, []);

  useEffect(() => {
    setJoinHref(
      buildWaitlistJoinHref(
        new URLSearchParams(window.location.search),
        document.referrer
      )
    );
    if (!initialSession) void loadSession();
    return cancelPendingSession;
  }, [cancelPendingSession, initialSession, loadSession]);

  useEffect(() => {
    if (state.status !== "signed-in") return;
    const { member } = state.data;
    if (identifiedMemberRef.current === member.analyticsId) return;
    identifyMember(member.analyticsId, {
      referral_code: member.referralCode,
      newsletter_opt_in: member.newsletterOptIn,
    });
    identifiedMemberRef.current = member.analyticsId;
  }, [state]);

  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "visible" && !consentLock.current)
        void loadSession();
    }
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadSession]);

  const updateNewsletterConsent = useCallback(async (subscribed: boolean) => {
    if (consentLock.current) return;
    consentLock.current = true;
    sessionRequestRef.current++;
    setConsentSaving(true);
    setConsentError(null);
    try {
      const response = await fetch("/api/newsletter-consent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletterOptIn: subscribed }),
      });
      const result = (await response.json()) as { newsletterOptIn?: unknown };
      if (!response.ok || typeof result?.newsletterOptIn !== "boolean")
        throw new Error("preference_failed");
      const newsletterOptIn = result.newsletterOptIn;
      setState((current) =>
        current.status === "signed-in"
          ? {
              ...current,
              data: {
                ...current.data,
                member: { ...current.data.member, newsletterOptIn },
              },
            }
          : current
      );
    } catch {
      setConsentError(
        "We couldn’t save your email preference. Please try again."
      );
    } finally {
      consentLock.current = false;
      setConsentSaving(false);
    }
  }, []);
  const onAuthStart = useCallback(() => {
    captureEvent("waitlist_auth_started", {
      referred: new URL(joinHref, "https://local.invalid").searchParams.has(
        "ref"
      ),
    });
  }, [joinHref]);
  const onSignOut = useCallback(() => {
    resetAnalyticsIdentity();
    identifiedMemberRef.current = null;
  }, []);
  const value = useMemo(
    () => ({
      state,
      joinHref,
      onAuthStart,
      onSignOut,
      updateNewsletterConsent,
      consentSaving,
      consentError,
    }),
    [
      state,
      joinHref,
      onAuthStart,
      onSignOut,
      updateNewsletterConsent,
      consentSaving,
      consentError,
    ]
  );
  return (
    <WaitlistContext.Provider value={value}>
      {children}
    </WaitlistContext.Provider>
  );
}

export function useWaitlistSession() {
  const value = useContext(WaitlistContext);
  if (!value)
    throw new Error(
      "useWaitlistSession must be used within WaitlistSessionProvider"
    );
  return value;
}
