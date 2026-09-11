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
vi.mock("@/lib/access/service", () => ({ getAccessDecision: vi.fn() }));
vi.mock("@/lib/admin/permissions", () => ({
  getAdminPrincipalForUser: vi.fn(),
}));
import { getAuthenticatedIdentity } from "@/lib/authentication/session";
import { resolveProviderIdentity } from "@/lib/identity/provider-user";
import { enrollAuthenticatedUser } from "@/lib/access/enrollment";
import { getAccessDecision } from "@/lib/access/service";
import { getAdminPrincipalForUser } from "@/lib/admin/permissions";
import { signedInLandingPath } from "@/lib/identity/signed-in-landing";
const identity = {
  authority: "auth0",
  issuer: "https://auth.invalid",
  subject: "auth0|fixture",
  emailVerified: true,
  email: "fixture@example.invalid",
};
const canonical = {
  userId: "user",
  identityId: "identity",
  accountStatus: "active" as const,
  conflicts: [],
  identityCreated: false,
};
describe("post-Auth0 landing on login paths", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthenticatedIdentity).mockResolvedValue(identity);
    vi.mocked(resolveProviderIdentity).mockResolvedValue(canonical);
    vi.mocked(enrollAuthenticatedUser).mockResolvedValue({
      enrolled: true,
      signupId: "signup",
    });
    vi.mocked(getAccessDecision).mockResolvedValue({
      state: "pending",
      userId: "user",
    });
    vi.mocked(getAdminPrincipalForUser).mockResolvedValue(null);
  });
  it("sends approved ordinary users home and administrators to administration", async () => {
    vi.mocked(getAccessDecision).mockResolvedValue({
      state: "approved",
      userId: "user",
    });
    expect(await signedInLandingPath("/home")).toBe("/home");
    vi.mocked(getAdminPrincipalForUser).mockResolvedValue({
      adminGrantId: "grant",
      signupId: "signup",
      userId: "user",
    });
    expect(await signedInLandingPath("/home")).toBe("/admin");
  });
  it("preserves waitlist, device, and MCP destinations without treating them as approval", async () => {
    for (const path of [
      "/waitlist",
      "/device?user_code=ABC",
      "/api/mcp/oauth/callback?state=opaque",
    ])
      expect(await signedInLandingPath(path)).toBe(path);
    expect(await signedInLandingPath("//evil.invalid")).toBe("/access-pending");
  });
  it("retains authentication on storage failure but routes to the fail-closed waiting surface", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(resolveProviderIdentity).mockRejectedValue(
      new Error("unavailable")
    );
    expect(await signedInLandingPath("/home")).toBe("/access-pending");
    log.mockRestore();
  });
  it("sends unauthenticated callers to sign-in", async () => {
    vi.mocked(getAuthenticatedIdentity).mockResolvedValue(null);
    expect(await signedInLandingPath("/keys")).toBe("/login?returnTo=%2Fkeys");
    expect(enrollAuthenticatedUser).not.toHaveBeenCalled();
  });
});
