import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/authentication/session", () => ({
  getAuthenticatedIdentity: vi.fn(),
}));
vi.mock("@/lib/identity/provider-user", () => ({
  resolveProviderIdentity: vi.fn(),
}));
vi.mock("@/lib/access/enrollment", () => ({
  enrollAuthenticatedUser: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: () => ({ value: "legacy-admin-cookie" }) })),
}));
import { cookies } from "next/headers";
import { getAuthenticatedIdentity } from "@/lib/authentication/session";
import { resolveProviderIdentity } from "@/lib/identity/provider-user";
import { enrollAuthenticatedUser } from "@/lib/access/enrollment";
import { getDb } from "@/lib/db";
import { getAuthenticatedWaitlistSignup } from "./current-session";
import { GET as sessionRoute } from "@/app/api/session/route";
import { PUT as consentRoute } from "@/app/api/newsletter-consent/route";
const limit = vi.fn();
describe("Auth0-derived waitlist membership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthenticatedIdentity).mockResolvedValue(null);
    vi.mocked(getDb).mockReturnValue({
      select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
    } as unknown as ReturnType<typeof getDb>);
  });
  it("legacy admin/session cookies cannot authorize membership or consent", async () => {
    expect(await getAuthenticatedWaitlistSignup()).toBeNull();
    expect((await sessionRoute()).status).toBe(401);
    expect(
      (
        await consentRoute(
          new Request("https://preview.invalid/api/newsletter-consent", {
            method: "PUT",
            headers: {
              origin: "https://preview.invalid",
              "content-type": "application/json",
            },
            body: JSON.stringify({ newsletterOptIn: true }),
          })
        )
      ).status
    ).toBe(401);
    expect(cookies).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
  });
  it("returns the trusted canonical signup without requiring product approval", async () => {
    vi.mocked(getAuthenticatedIdentity).mockResolvedValue({
      authority: "auth0",
      issuer: "https://auth.invalid",
      subject: "fixture",
      emailVerified: true,
    });
    vi.mocked(resolveProviderIdentity).mockResolvedValue({
      userId: "canonical",
      identityId: "identity",
      accountStatus: "active",
      conflicts: [],
      identityCreated: false,
    });
    const signup = { id: "signup", userId: "canonical", status: "confirmed" };
    limit.mockResolvedValue([signup]);
    expect(await getAuthenticatedWaitlistSignup()).toEqual({
      signup,
      userId: "canonical",
    });
    expect(enrollAuthenticatedUser).not.toHaveBeenCalled();
  });
  it("does not enroll a signed-in visitor during background membership reads", async () => {
    vi.mocked(getAuthenticatedIdentity).mockResolvedValue({
      authority: "auth0",
      issuer: "https://auth.invalid",
      subject: "new-visitor",
      emailVerified: true,
      email: "new@example.invalid",
    });
    vi.mocked(resolveProviderIdentity).mockResolvedValue({
      userId: "canonical-new",
      identityId: "identity-new",
      accountStatus: "active",
      conflicts: [],
      identityCreated: false,
    });
    limit.mockResolvedValue([]);
    expect(await getAuthenticatedWaitlistSignup()).toBeNull();
    expect((await sessionRoute()).status).toBe(401);
    expect(enrollAuthenticatedUser).not.toHaveBeenCalled();
  });
  it("rejects disabled canonical users without consulting legacy sessions", async () => {
    vi.mocked(getAuthenticatedIdentity).mockResolvedValue({
      authority: "auth0",
      issuer: "https://auth.invalid",
      subject: "fixture",
      emailVerified: true,
    });
    vi.mocked(resolveProviderIdentity).mockResolvedValue({
      userId: "canonical",
      identityId: "identity",
      accountStatus: "disabled",
      conflicts: [],
      identityCreated: false,
    });
    expect(await getAuthenticatedWaitlistSignup()).toBeNull();
    expect(getDb).not.toHaveBeenCalled();
  });
  it("does not disguise identity storage failure as a valid waitlist session", async () => {
    vi.mocked(getAuthenticatedIdentity).mockRejectedValue(
      new Error("session unavailable")
    );
    expect((await sessionRoute()).status).toBe(503);
  });
});
