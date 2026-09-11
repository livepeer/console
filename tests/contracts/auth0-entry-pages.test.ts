import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  landing: vi.fn(async (returnTo: string) => returnTo),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/authentication/session", () => ({
  getAuthenticatedIdentity: mocks.identity,
}));
vi.mock("@/lib/identity/signed-in-landing", () => ({
  signedInLandingPath: mocks.landing,
}));
vi.mock("@/components/console/LoginPage", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
import LoginRoute from "@/app/(auth)/login/page";
import SignupRoute from "@/app/(auth)/signup/page";
import RootPage from "@/app/(app)/page";

beforeEach(() => {
  mocks.identity.mockResolvedValue({ subject: "synthetic" });
  mocks.landing.mockImplementation(async (returnTo: string) => returnTo);
});
it("signed-in login and signup land through the page, not a sync route", async () => {
  for (const page of [LoginRoute, SignupRoute])
    await expect(page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "redirect:/home"
    );
});
it("preserves MCP and explicit device return paths through login", async () => {
  await expect(
    LoginRoute({ searchParams: Promise.resolve({ mcp_oauth: "1" }) })
  ).rejects.toThrow("redirect:/api/mcp/oauth/callback");
  await expect(
    LoginRoute({
      searchParams: Promise.resolve({ returnTo: "/device?code=fixture" }),
    })
  ).rejects.toThrow("redirect:/device?code=fixture");
});
it("root goes home and preserves legacy referral links", async () => {
  await expect(RootPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    "redirect:/home"
  );
  await expect(
    RootPage({ searchParams: Promise.resolve({ ref: "abc_123" }) })
  ).rejects.toThrow("redirect:/waitlist?ref=abc_123");
});
