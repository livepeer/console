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
import { getAuthenticatedIdentity } from "@/lib/authentication/session";
import { resolveProviderIdentity } from "@/lib/identity/provider-user";
import { requireApprovedUser, AccessError } from "@/lib/access/service";
import { resolveExternalAccount } from "@/lib/external-accounts/service";
import { requireConsoleSession } from "@/lib/console/session-user";
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
    vi.mocked(requireApprovedUser).mockResolvedValue({
      state: "approved",
      userId: "user",
    });
    vi.mocked(resolveExternalAccount).mockResolvedValue({
      id: "account",
      userId: "user",
      externalUserId: "persisted-legacy-id",
    });
  });
  it("returns the persisted billing alias, never a provider-subject hash", async () => {
    expect(await requireConsoleSession()).toMatchObject({
      externalUserId: "persisted-legacy-id",
      canonicalUserId: "user",
    });
  });
  it("returns401 for an unauthenticated caller without enrollment", async () => {
    vi.mocked(getAuthenticatedIdentity).mockResolvedValue(null);
    await expect(requireConsoleSession()).rejects.toMatchObject({
      status: 401,
    });
    expect(resolveProviderIdentity).not.toHaveBeenCalled();
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
    log.mockRestore();
  });
});
