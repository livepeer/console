import { describe, expect, it } from "vitest";
import {
  isProtocolReturnPath,
  waitlistAuthLoginPath,
  waitlistEnrollmentContext,
} from "./auth-join";
import { POST } from "@/app/api/waitlist/route";
describe("Auth0 waitlist entry", () => {
  it("carries bounded public context through the Auth0 transaction returnTo", () => {
    const params = new URLSearchParams({
      ref: "friend-code",
      utm_source: " campaign ",
      utm_content: "a".repeat(400),
      referrer: "https://referrer.invalid/private?token=secret",
      email: "other@example.invalid",
      marketingConsent: "true",
      accountRole: "admin",
      externalUserId: "billing",
      returnTo: "https://evil.invalid",
    });
    const login = new URL(
      waitlistAuthLoginPath(params),
      "https://preview.invalid"
    );
    expect(login.pathname).toBe("/auth/login");
    const sync = new URL(login.searchParams.get("returnTo")!, login.origin);
    expect(sync.pathname).toBe("/api/identity/sync");
    expect(sync.searchParams.get("from")).toBe("waitlist");
    expect(waitlistEnrollmentContext(sync.searchParams)).toEqual({
      source: "waitlist_auth",
      referralCode: "friend-code",
      attribution: {
        utm_source: "campaign",
        utm_content: "a".repeat(200),
        landing_page: "/waitlist",
        referrer: "https://referrer.invalid",
      },
    });
    for (const key of [
      "email",
      "marketingConsent",
      "accountRole",
      "externalUserId",
      "returnTo",
    ])
      expect(sync.searchParams.has(key)).toBe(false);
  });
  it("drops invalid referrals and credentialed/non-web referrers", () => {
    expect(
      waitlistEnrollmentContext(
        new URLSearchParams({
          ref: "x".repeat(65),
          referrer: "https://user:pass@referrer.invalid",
        })
      )
    ).toEqual({
      source: "waitlist_auth",
      attribution: { landing_page: "/waitlist" },
    });
    expect(
      waitlistEnrollmentContext(
        new URLSearchParams({ referrer: "javascript:alert(1)" })
      ).attribution
    ).not.toHaveProperty("referrer");
  });
  it("only preserves recognized exact protocol/device paths", () => {
    expect(isProtocolReturnPath("/device?user_code=ABC")).toBe(true);
    expect(isProtocolReturnPath("/api/mcp/oauth/callback?state=opaque")).toBe(
      true
    );
    expect(isProtocolReturnPath("/device-other")).toBe(false);
    expect(isProtocolReturnPath("//evil.invalid/device")).toBe(false);
  });
  it("retires anonymous signup and magic-link issuance without creating a session", async () => {
    const response = POST();
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({
      error: "auth0_signin_required",
      signInUrl: "/api/waitlist/join",
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
