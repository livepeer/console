// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const analytics = vi.hoisted(() => ({
  captureEvent: vi.fn(),
  identifyMember: vi.fn(),
  resetAnalyticsIdentity: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ ...analytics }));
import {
  useWaitlistSession,
  WaitlistSessionProvider,
} from "./waitlist-session";
import { buildWaitlistJoinHref } from "./waitlist-auth-navigation";
import type { WaitlistSessionResponse } from "@/lib/waitlist/contracts";
const memberSession: WaitlistSessionResponse = {
  member: {
    accountRole: "member",
    analyticsId: "opaque-member-id",
    displayName: "bu•••••@example.com",
    email: "builder@example.com",
    newsletterOptIn: false,
    points: 0,
    position: 1,
    referralCode: "server-code",
    referralUrl: "https://example.com/waitlist?ref=server-code",
    referrals: { pending: 0, verified: 0 },
  },
};
function Probe() {
  const {
    state,
    joinHref,
    onAuthStart,
    onSignOut,
    updateNewsletterConsent,
    consentError,
    consentSaving,
  } = useWaitlistSession();
  return (
    <div>
      <output data-testid="state">{state.status}</output>
      <output data-testid="consent">
        {state.status === "signed-in"
          ? String(state.data.member.newsletterOptIn)
          : ""}
      </output>
      <a
        href={joinHref}
        onClick={(event) => {
          event.preventDefault();
          onAuthStart();
        }}
      >
        Join
      </a>
      <a href={joinHref}>Sign in</a>
      <a
        href="/auth/logout"
        onClick={(event) => {
          event.preventDefault();
          onSignOut();
        }}
      >
        Sign out
      </a>
      <button
        disabled={consentSaving}
        onClick={() => void updateNewsletterConsent(true)}
      >
        Subscribe
      </button>
      {consentError && <p role="alert">{consentError}</p>}
    </div>
  );
}
function renderProvider(initialSession: WaitlistSessionResponse | null) {
  return render(
    <WaitlistSessionProvider initialSession={initialSession}>
      <Probe />
    </WaitlistSessionProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/waitlist");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Auth0 waitlist presentation", () => {
  it("identifies a hydrated member with only the opaque identifier", async () => {
    renderProvider(memberSession);
    await waitFor(() =>
      expect(analytics.identifyMember).toHaveBeenCalledOnce()
    );
    expect(analytics.identifyMember).toHaveBeenCalledWith("opaque-member-id", {
      referral_code: "server-code",
      newsletter_opt_in: false,
    });
    expect(JSON.stringify(analytics.identifyMember.mock.calls)).not.toContain(
      "builder@example.com"
    );
  });
  it("both join and sign-in navigate to the bounded GET handoff without anonymous signup POST", async () => {
    window.history.replaceState(
      null,
      "",
      "/waitlist?ref=FRIEND&utm_source=community&email=private@example.invalid&isAdmin=true"
    );
    const fetcher = vi.fn(async () =>
      Response.json({ message: "Signed out" }, { status: 401 })
    );
    vi.stubGlobal("fetch", fetcher);
    renderProvider(null);
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Join" }).getAttribute("href")
      ).toContain("ref=FRIEND")
    );
    const href = screen
      .getByRole("link", { name: "Join" })
      .getAttribute("href")!;
    expect(
      screen.getByRole("link", { name: "Sign in" }).getAttribute("href")
    ).toBe(href);
    expect(href).toContain("/api/waitlist/join?");
    expect(href).not.toContain("email");
    expect(href).not.toContain("isAdmin");
    fireEvent.click(screen.getByRole("link", { name: "Join" }));
    expect(analytics.captureEvent).toHaveBeenCalledWith(
      "waitlist_auth_started",
      { referred: true }
    );
    expect(fetcher.mock.calls).toEqual([
      ["/api/session", { cache: "no-store" }],
    ]);
    expect(screen.queryByText(/check your email/i)).toBeNull();
  });
  it("uses Auth0 logout rather than a legacy session mutation", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    renderProvider(memberSession);
    expect(
      screen.getByRole("link", { name: "Sign out" }).getAttribute("href")
    ).toBe("/auth/logout");
    fireEvent.click(screen.getByRole("link", { name: "Sign out" }));
    expect(analytics.resetAnalyticsIdentity).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("saves newsletter preference independently of product approval", async () => {
    const fetcher = vi.fn(async () => Response.json({ newsletterOptIn: true }));
    vi.stubGlobal("fetch", fetcher);
    renderProvider(memberSession);
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    await waitFor(() =>
      expect(screen.getByTestId("consent").textContent).toBe("true")
    );
    expect(fetcher).toHaveBeenCalledWith("/api/newsletter-consent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newsletterOptIn: true }),
    });
  });
  it("does not claim a preference saved after transport failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    renderProvider(memberSession);
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    await screen.findByRole("alert");
    expect(screen.getByTestId("consent").textContent).toBe("false");
    expect(
      (screen.getByRole("button", { name: "Subscribe" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
  it("bounds attribution and strips authority data and referrer paths", () => {
    const href = buildWaitlistJoinHref(
      new URLSearchParams({
        ref: "bad/ref",
        utm_source: "a".repeat(500),
        newsletterOptIn: "true",
        returnTo: "//attacker",
        role: "admin",
      }),
      "https://referrer.example/private?email=secret"
    );
    const params = new URL(href, "https://console.example").searchParams;
    expect(params.get("utm_source")).toHaveLength(200);
    expect(params.get("landing_page")).toBe("/waitlist");
    expect(params.get("referrer")).toBe("https://referrer.example");
    expect([...params.keys()].sort()).toEqual([
      "landing_page",
      "referrer",
      "utm_source",
    ]);
    expect(
      buildWaitlistJoinHref(new URLSearchParams({ ref: "x".repeat(65) }))
    ).not.toContain("ref=");
  });
});
