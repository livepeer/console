import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth0", () => ({ auth0: { getSession: vi.fn() } }));
vi.mock("@/lib/identity/canonical-user", () => ({
  syncCanonicalUser: vi.fn(),
  syncCanonicalUserBestEffort: vi.fn(),
}));
vi.mock("@/lib/mcp/as", () => ({
  parsePending: vi.fn(() => ({
    redirectUri: "https://client.example/callback",
    codeChallenge: "test-pkce-challenge",
    clientId: "test-client",
    clientState: "original-client-state",
  })),
  issueAuthCode: vi.fn(() => "test-authorization-code"),
  PKCE_COOKIE: "test-pkce",
  pkceCookieOptions: () => ({ httpOnly: true, path: "/" }),
}));

import { auth0 } from "@/lib/auth0";
import {
  syncCanonicalUser,
  syncCanonicalUserBestEffort,
} from "./canonical-user";
import {
  requireCanonicalUser,
  requireConsoleSession,
} from "@/lib/console/session-user";
import { externalUserIdFromSub } from "@/lib/console/external-user-id";
import { issueAuthCode } from "@/lib/mcp/as";
import { GET as mcpCallback } from "@/app/api/mcp/oauth/callback/route";

const session = {
  user: {
    sub: "auth0|existing-billing-user",
    email: "test@example.invalid",
    email_verified: true,
  },
  tokenSet: { accessToken: "test", expiresAt: 0 },
  internal: { sid: "test", createdAt: 0 },
};

describe("authenticated server compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth0.getSession).mockResolvedValue(session);
    vi.mocked(syncCanonicalUserBestEffort).mockResolvedValue(null);
  });

  it("keeps the legacy session usable when identity storage is unavailable", async () => {
    const result = await requireConsoleSession();
    expect(result).toEqual({
      externalUserId: await externalUserIdFromSub(session.user.sub),
      email: session.user.email,
    });
    expect(syncCanonicalUserBestEffort).toHaveBeenCalledWith({
      sub: session.user.sub,
      email: session.user.email,
      emailVerified: true,
    });
  });

  it("retries synchronization on subsequent authenticated server requests", async () => {
    await requireConsoleSession();
    await requireConsoleSession();
    expect(syncCanonicalUserBestEffort).toHaveBeenCalledTimes(2);
  });

  it("rejects unauthenticated callers without creating a canonical user", async () => {
    vi.mocked(auth0.getSession).mockResolvedValue(null);
    await expect(requireConsoleSession()).rejects.toMatchObject({
      status: 401,
    });
    await expect(requireCanonicalUser()).rejects.toMatchObject({ status: 401 });
    expect(syncCanonicalUser).not.toHaveBeenCalled();
    expect(syncCanonicalUserBestEffort).not.toHaveBeenCalled();
  });

  it("fails closed only for features requiring a canonical record", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      vi.mocked(syncCanonicalUser).mockRejectedValue(
        new Error("database unavailable")
      );
      await expect(requireCanonicalUser()).rejects.toMatchObject({
        status: 503,
        code: "canonical_user_unavailable",
      });
      await expect(requireConsoleSession()).resolves.toHaveProperty(
        "externalUserId"
      );
    } finally {
      log.mockRestore();
    }
  });

  it("still issues the same MCP authorization payload during a database outage", async () => {
    const response = await mcpCallback(
      new NextRequest("https://console.example/api/mcp/oauth/callback")
    );
    expect(response.status).toBe(302);
    const target = new URL(response.headers.get("location")!);
    expect(target.origin).toBe("https://client.example");
    expect(target.searchParams.get("state")).toBe("original-client-state");
    expect(target.searchParams.get("code")).toBe("test-authorization-code");
    expect(issueAuthCode).toHaveBeenCalledWith({
      redirectUri: "https://client.example/callback",
      codeChallenge: "test-pkce-challenge",
      clientId: "test-client",
      externalUserId: await externalUserIdFromSub(session.user.sub),
      email: session.user.email,
    });
    expect(syncCanonicalUserBestEffort).toHaveBeenCalledOnce();
  });

  it("denies disabled profiles only at the canonical-only boundary", async () => {
    vi.mocked(syncCanonicalUser).mockResolvedValue({
      userId: "test-user",
      accountStatus: "disabled",
      externalUserId: "eu_test",
      identityCreated: false,
      waitlistLinked: false,
      conflicts: [],
    });
    await expect(requireCanonicalUser()).rejects.toMatchObject({
      status: 403,
      code: "canonical_user_disabled",
    });
    await expect(requireConsoleSession()).resolves.toHaveProperty(
      "externalUserId"
    );
  });
});
