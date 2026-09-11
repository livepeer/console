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
vi.mock("@/lib/access/service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/access/service")>();
  return { ...original, requireApprovedUser: vi.fn() };
});
vi.mock("@/lib/external-accounts/service", () => ({
  configuredPymthouseScope: () => ({
    service: "pymthouse",
    issuer: "https://issuer.example.invalid",
    appId: "test",
  }),
  resolveExternalAccount: vi.fn(),
}));
vi.mock("@/lib/console/pymthouse-bff", () => ({
  getEndUserAccessToken: vi.fn(),
}));
import { getAuthenticatedIdentity } from "@/lib/authentication/session";
import { resolveProviderIdentity } from "@/lib/identity/provider-user";
import { requireApprovedUser, AccessError } from "@/lib/access/service";
import { resolveExternalAccount } from "@/lib/external-accounts/service";
import { getEndUserAccessToken } from "@/lib/console/pymthouse-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import { enrollAuthenticatedUser } from "@/lib/access/enrollment";
const identity = {
  authority: "auth0",
  issuer: "https://auth.example.invalid",
  subject: "existing-sub",
  email: "test@example.invalid",
  emailVerified: true,
};
describe("shared server admission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthenticatedIdentity).mockResolvedValue(identity);
    vi.mocked(resolveProviderIdentity).mockResolvedValue({
      userId: "user",
      identityId: "identity",
      accountStatus: "active",
      conflicts: [],
      identityCreated: false,
    });
    vi.mocked(enrollAuthenticatedUser).mockResolvedValue({
      enrolled: true,
      signupId: "signup",
    });
    vi.mocked(requireApprovedUser).mockResolvedValue({
      state: "approved",
      userId: "user",
    });
    vi.mocked(resolveExternalAccount).mockResolvedValue({
      id: "account",
      userId: "user",
      externalUserId: "persisted-legacy-id",
    });
    vi.mocked(getEndUserAccessToken).mockResolvedValue({
      access_token: "tok",
      refresh_token: "refresh",
      token_type: "Bearer",
      expires_in: 300,
      scope: "sign:job",
    });
  });
  it("returns the persisted billing alias, never a provider-subject hash", async () => {
    expect(await requireConsoleSession()).toMatchObject({
      externalUserId: "persisted-legacy-id",
      canonicalUserId: "user",
    });
    expect(getEndUserAccessToken).toHaveBeenCalledWith(
      "persisted-legacy-id",
      "test@example.invalid"
    );
  });
  it("returns401 for an unauthenticated caller without enrollment", async () => {
    vi.mocked(getAuthenticatedIdentity).mockResolvedValue(null);
    await expect(requireConsoleSession()).rejects.toMatchObject({
      status: 401,
    });
    expect(resolveProviderIdentity).not.toHaveBeenCalled();
    expect(getEndUserAccessToken).not.toHaveBeenCalled();
  });
  it.each(["pending", "revoked", "disabled"] as const)(
    "denies %s before account resolution",
    async (state) => {
      vi.mocked(requireApprovedUser).mockRejectedValue(new AccessError(state));
      await expect(requireConsoleSession()).rejects.toMatchObject({
        status: 403,
        state,
      });
      expect(resolveExternalAccount).not.toHaveBeenCalled();
      expect(getEndUserAccessToken).not.toHaveBeenCalled();
    }
  );
  it("keeps the authenticated session but denies product operations during DB failure and retries", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(resolveProviderIdentity).mockRejectedValueOnce(
      new Error("database unavailable")
    );
    await expect(requireConsoleSession()).rejects.toMatchObject({
      status: 503,
    });
    await expect(requireConsoleSession()).resolves.toHaveProperty(
      "externalUserId"
    );
    expect(resolveProviderIdentity).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
  it("fails closed for ambiguous external account mapping", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(resolveExternalAccount).mockRejectedValue(new Error("ambiguous"));
    await expect(requireConsoleSession()).rejects.toMatchObject({
      status: 503,
    });
    expect(getEndUserAccessToken).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it.each(["email_conflict", "waitlist_conflict", "inactive_contact"])(
    "does not claim confirmed waitlist membership after %s",
    async (reason) => {
      vi.mocked(enrollAuthenticatedUser).mockResolvedValue({
        enrolled: false,
        reason,
      });
      vi.mocked(requireApprovedUser).mockRejectedValue(
        new AccessError("pending")
      );
      await expect(requireConsoleSession()).rejects.toMatchObject({
        status: 403,
        state: "pending",
        code: "enrollment_attention_required",
      });
      expect(resolveExternalAccount).not.toHaveBeenCalled();
      expect(getEndUserAccessToken).not.toHaveBeenCalled();
    }
  );
  it("retains verify-email behavior for unverified identities", async () => {
    vi.mocked(getAuthenticatedIdentity).mockResolvedValue({
      ...identity,
      emailVerified: false,
    });
    vi.mocked(enrollAuthenticatedUser).mockResolvedValue({
      enrolled: false,
      reason: "unverified_or_disabled",
    });
    vi.mocked(requireApprovedUser).mockRejectedValue(
      new AccessError("pending")
    );
    await expect(requireConsoleSession()).rejects.toMatchObject({
      code: "access_pending",
    });
  });
  it("honors existing approval even when a changed email cannot be enrolled", async () => {
    vi.mocked(enrollAuthenticatedUser).mockResolvedValue({
      enrolled: false,
      reason: "waitlist_conflict",
    });
    await expect(requireConsoleSession()).resolves.toHaveProperty(
      "externalUserId"
    );
  });
  it("keeps the Auth0 session when PymtHouse mint fails after cookie validation", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getEndUserAccessToken).mockRejectedValue(
      new Error("mint_failed")
    );
    await expect(requireConsoleSession()).resolves.toMatchObject({
      externalUserId: "persisted-legacy-id",
    });
    log.mockRestore();
  });
  it.each(["revoked", "disabled", "unavailable"] as const)(
    "preserves %s precedence over enrollment attention",
    async (state) => {
      vi.mocked(enrollAuthenticatedUser).mockResolvedValue({
        enrolled: false,
        reason: "inactive_contact",
      });
      vi.mocked(requireApprovedUser).mockRejectedValue(new AccessError(state));
      await expect(requireConsoleSession()).rejects.toMatchObject({
        state,
        code: `access_${state}`,
      });
    }
  );
});
