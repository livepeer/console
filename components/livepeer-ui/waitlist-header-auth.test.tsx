// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/analytics", () => ({
  captureEvent: vi.fn(),
  identifyMember: vi.fn(),
  resetAnalyticsIdentity: vi.fn(),
}));
import { WaitlistSessionProvider } from "./waitlist-session";
import {
  JoinWaitlistControl,
  WaitlistHeaderAuth,
} from "./waitlist-header-auth";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("waitlist Auth0 controls", () => {
  it("offers live Join and Sign in links with no email form or verification dialog", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 401 }))
    );
    render(
      <WaitlistSessionProvider initialSession={null}>
        <WaitlistHeaderAuth />
        <JoinWaitlistControl defaultExpanded showVerificationDialog />
      </WaitlistSessionProvider>
    );
    for (const link of screen.getAllByRole("link", {
      name: /Join waitlist|Sign in/,
    }))
      expect(link.getAttribute("href")).toContain("/api/waitlist/join?");
    expect(document.querySelector('input[type="email"]')).toBeNull();
    expect(screen.queryByText(/Check your email/)).toBeNull();
  });
  it("keeps referral details and optional email preferences available to waiting members", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ newsletterOptIn: true }))
    );
    render(
      <WaitlistSessionProvider
        initialSession={{
          member: {
            accountRole: "member",
            analyticsId: "opaque",
            displayName: "fixture",
            email: "fixture@example.invalid",
            newsletterOptIn: false,
            points: 2,
            position: 7,
            referralCode: "CODE",
            referralUrl: "https://example.com/waitlist?ref=CODE",
            referrals: { pending: 1, verified: 2 },
          },
        }}
      >
        <WaitlistHeaderAuth />
      </WaitlistSessionProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Your waitlist" }));
    const checkbox = await screen.findByRole("checkbox", {
      name: /Subscribe for product updates/,
    });
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Verified referrals")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    fireEvent.click(checkbox);
    await waitFor(() =>
      expect((checkbox as HTMLInputElement).checked).toBe(true)
    );
    expect(screen.queryByText(/check your email/i)).toBeNull();
  });
});
