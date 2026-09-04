import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), identity: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  },
}));
vi.mock("@/lib/console/session-user", () => ({
  requireConsoleSession: mocks.session,
}));
vi.mock("@/lib/authentication/session", () => ({
  getAuthenticatedIdentity: mocks.identity,
}));

import { requireConsolePage } from "@/lib/access/page";
import AccessPendingPage from "@/app/access-pending/page";
import { WaitingContent, waitingCopy } from "@/app/access-pending/content";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("CONSOLE_DEV_MOCK", "0");
  mocks.session.mockReset();
  mocks.identity.mockReset();
});

describe("server page admission", () => {
  it("uses the shared backend approval gate", async () => {
    mocks.session.mockResolvedValue({ externalUserId: "persisted" });
    await expect(requireConsolePage("/keys")).resolves.toEqual({
      externalUserId: "persisted",
    });
    expect(mocks.session).toHaveBeenCalledOnce();
  });
  it("redirects unauthenticated requests to sign-in with a safe return path", async () => {
    mocks.session.mockRejectedValue({ status: 401 });
    await expect(requireConsolePage("/keys")).rejects.toThrow(
      "redirect:/login?returnTo=%2Fkeys"
    );
  });
  it.each([403, 503])(
    "uses waiting UI without bypass for status %i",
    async (status) => {
      mocks.session.mockRejectedValue({ status });
      await expect(requireConsolePage("/device?iss=example")).rejects.toThrow(
        "redirect:/access-pending?returnTo=%2Fdevice%3Fiss%3Dexample"
      );
    }
  );
  it("never enables local dev bypass in a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONSOLE_DEV_MOCK", "1");
    mocks.session.mockRejectedValue({ status: 403 });
    await expect(requireConsolePage()).rejects.toThrow(
      "redirect:/access-pending"
    );
  });
});

describe("waiting states", () => {
  it("approved users continue, untrusted absolute return URLs do not", async () => {
    mocks.session.mockResolvedValue({ externalUserId: "persisted" });
    await expect(
      AccessPendingPage({
        searchParams: Promise.resolve({ returnTo: "https://evil.example" }),
      })
    ).rejects.toThrow("redirect:/home");
  });
  it("does not loop when the requested return path is the waiting page", async () => {
    mocks.session.mockResolvedValue({});
    await expect(
      AccessPendingPage({
        searchParams: Promise.resolve({
          returnTo: "/access-pending?state=approved",
        }),
      })
    ).rejects.toThrow("redirect:/home");
  });
  it.each([
    ["access_pending", true, "pending"],
    ["access_pending", false, "verify-email"],
    ["access_revoked", true, "revoked"],
    ["access_disabled", true, "disabled"],
    ["access_unavailable", true, "unavailable"],
  ] as const)(
    "renders authoritative %s state with verified email %s",
    async (code, verified, expectedState) => {
      mocks.session.mockRejectedValue({
        status: code === "access_unavailable" ? 503 : 403,
        code,
      });
      mocks.identity.mockResolvedValue({
        email: "test@example.invalid",
        emailVerified: verified,
      });
      const result = await AccessPendingPage({
        searchParams: Promise.resolve({}),
      });
      expect(result.props.state).toBe(expectedState);
      const html = renderToStaticMarkup(result);
      expect(html).toContain(waitingCopy[expectedState].title);
      expect(html).toContain('href="/auth/logout"');
      expect(html).not.toContain("test@example.invalid");
    }
  );
  it("renders retry and independent consent copy on outages", () => {
    const html = renderToStaticMarkup(
      createElement(WaitingContent, {
        state: "unavailable",
        retryHref: "/access-pending",
      })
    );
    expect(html).toContain("Check access again");
    expect(html).toContain("does not subscribe you to marketing emails");
  });
});
