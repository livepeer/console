import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { and, eq, inArray, isNull, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type postgres from "postgres";
import * as schema from "@/lib/db/schema";
import { EmailProviderError } from "@/lib/email/provider";
import { openIntegrationDatabase } from "@/tests/support/isolated-db";

const mocks = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  send: vi.fn(),
  audience: vi.fn(),
  identity: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/authentication/session", () => ({
  getAuthenticatedIdentity: mocks.identity,
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    NEXT_PUBLIC_SITE_URL: "https://preview.example.invalid",
    ATTRIBUTION_HASH_SECRET: "integration-attribution-secret-not-production",
    INTERNAL_OUTBOX_SECRET: "integration-outbox-secret-not-production",
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      mocks.cookies.has(name) ? { value: mocks.cookies.get(name) } : undefined,
    set: (name: string, value: string) => mocks.cookies.set(name, value),
    delete: (name: string) => mocks.cookies.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/analytics-server", () => ({ captureEmailVerified: vi.fn() }));
vi.mock("@/lib/email/resend", () => ({
  getEmailProviderFromEnv: () => ({ sendVerificationEmail: mocks.send }),
}));
vi.mock("@/lib/email/resend-audience", () => ({
  getAudienceProviderFromEnv: () => ({ updateContact: mocks.audience }),
}));

import { getDb } from "@/lib/db";
import { hashToken, SESSION_COOKIE } from "./security";
import { POST as signup } from "@/app/api/waitlist/route";
import { GET as verify } from "@/app/verify/route";
import { GET as session } from "@/app/api/session/route";
import { POST as logout } from "@/app/api/logout/route";
import { PUT as consent } from "@/app/api/newsletter-consent/route";
import { GET as csv } from "@/app/api/admin/signups.csv/route";
import { POST as outbox } from "@/app/api/internal/outbox/route";
import { resolveProviderIdentity } from "@/lib/identity/provider-user";
import { enrollAuthenticatedUser } from "@/lib/access/enrollment";
import {
  dispatchOutboxEvent,
  VERIFICATION_EMAIL_EVENT,
} from "@/lib/email/outbox";
import type { ProviderIdentity } from "@/lib/platform/contracts";

const prefix = `route-test-${randomUUID()}`;
let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof getDb>;
const userIds = new Set<string>();
const address = (name: string) => `${prefix}-${name}@example.invalid`;
function provider(name: string, verified = true): ProviderIdentity {
  return {
    authority: "auth0",
    issuer: "https://auth.example.invalid",
    subject: `${prefix}-${name}`,
    email: address(name),
    emailVerified: verified,
  };
}
function request(path: string, body?: object, method = "POST") {
  return new Request(`https://preview.example.invalid${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: "https://preview.example.invalid",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const workerRequest = () =>
  new Request("https://preview.example.invalid/api/internal/outbox", {
    method: "POST",
    headers: {
      authorization: "Bearer integration-outbox-secret-not-production",
    },
  });
async function record(email: string) {
  return (
    await db
      .select()
      .from(schema.waitlistSignups)
      .where(eq(schema.waitlistSignups.normalizedEmail, email))
  )[0];
}
async function authenticate(name: string, verified = true) {
  const identity = provider(name, verified);
  const canonical = await resolveProviderIdentity(identity);
  userIds.add(canonical.userId);
  mocks.identity.mockResolvedValue(identity);
  return { identity, canonical };
}
async function legacySignup(name: string) {
  const [row] = await db
    .insert(schema.waitlistSignups)
    .values({
      email: address(name),
      normalizedEmail: address(name),
      referralCode: randomUUID(),
      status: "pending",
      firstTouch: { utm_source: "legacy" },
      lastTouch: {},
    })
    .returning();
  return row;
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Auth0-first waitlist routes against isolated Postgres",
  () => {
    beforeAll(async () => {
      const isolated = await openIntegrationDatabase(process.env);
      client = isolated.client;
      db = drizzle(client, { schema });
      vi.mocked(getDb).mockImplementation(() => db);
      const outstanding = await db
        .select({ id: schema.emailOutbox.id })
        .from(schema.emailOutbox)
        .where(
          and(
            isNull(schema.emailOutbox.processedAt),
            isNull(schema.emailOutbox.terminalAt)
          )
        )
        .limit(1);
      if (outstanding.length)
        throw new Error(
          "Route tests require no outstanding isolated outbox events"
        );
    });
    beforeEach(() => {
      mocks.cookies.clear();
      mocks.identity.mockReset().mockResolvedValue(null);
      mocks.send
        .mockReset()
        .mockResolvedValue({ providerMessageId: "synthetic-delivery" });
      mocks.audience.mockReset().mockResolvedValue(undefined);
    });
    afterEach(async () => {
      if (!db) return;
      const rows = await db
        .select({ id: schema.waitlistSignups.id })
        .from(schema.waitlistSignups)
        .where(like(schema.waitlistSignups.normalizedEmail, `${prefix}%`));
      const ids = rows.map((row) => row.id);
      if (ids.length) {
        await db
          .delete(schema.adminRoleGrants)
          .where(inArray(schema.adminRoleGrants.signupId, ids));
        await db
          .delete(schema.consentEvents)
          .where(inArray(schema.consentEvents.signupId, ids));
        await db
          .delete(schema.emailSubscriptions)
          .where(inArray(schema.emailSubscriptions.signupId, ids));
        await db
          .delete(schema.emailOutbox)
          .where(inArray(schema.emailOutbox.signupId, ids));
        await db
          .delete(schema.waitlistSignups)
          .where(inArray(schema.waitlistSignups.id, ids));
      }
      if (userIds.size)
        await db
          .delete(schema.users)
          .where(inArray(schema.users.id, [...userIds]));
      userIds.clear();
    });
    afterAll(async () => {
      await client?.end();
    });

    it("joins through verified provider identity, preserves referral attribution, and keeps consent separate", async () => {
      const referrer = await authenticate("referrer");
      await enrollAuthenticatedUser(referrer.identity, referrer.canonical);
      const ref = await record(address("referrer"));
      const member = await authenticate("member");
      // A signed-in landing/session refresh must not enroll before referral context.
      expect((await session()).status).toBe(401);
      expect(await record(address("member"))).toBeUndefined();
      await enrollAuthenticatedUser(member.identity, member.canonical, {
        source: "waitlist_auth",
        referralCode: ref.referralCode,
        attribution: { utm_source: "integration", landing_page: "/waitlist" },
      });
      const enrolled = await record(address("member"));
      expect(enrolled).toMatchObject({
        status: "confirmed",
        userId: member.canonical.userId,
        referredBy: ref.id,
        marketingConsent: false,
        enrollmentSource: "waitlist_auth",
      });
      expect(enrolled.firstTouch.utm_source).toBe("integration");
      const response = await session();
      expect(response.status).toBe(200);
      expect((await response.json()).member).toMatchObject({
        email: address("member"),
        accountRole: "member",
        newsletterOptIn: false,
      });
      expect(
        await db
          .select()
          .from(schema.pointEvents)
          .where(eq(schema.pointEvents.referralSignupId, enrolled.id))
      ).toHaveLength(1);
      expect(mocks.send).not.toHaveBeenCalled();
      expect((await csv()).status).toBe(404);
      await db
        .insert(schema.adminRoleGrants)
        .values({ signupId: enrolled.id, source: "synthetic_fixture" });
      const exported = await csv();
      expect(exported.status).toBe(200);
      expect(await exported.text()).toContain(address("member"));
      expect((await (await session()).json()).member.accountRole).toBe("admin");
      expect(
        (
          await consent(
            request("/api/newsletter-consent", { newsletterOptIn: true }, "PUT")
          )
        ).status
      ).toBe(200);
      expect((await record(address("member"))).marketingConsent).toBe(true);
      expect(
        (
          await consent(
            request(
              "/api/newsletter-consent",
              { newsletterOptIn: false },
              "PUT"
            )
          )
        ).status
      ).toBe(200);
      expect((await record(address("member"))).marketingConsent).toBe(false);
      expect(mocks.audience).toHaveBeenLastCalledWith(
        expect.objectContaining({ email: address("member"), subscribed: false })
      );
      const changes = await db
        .select()
        .from(schema.consentEvents)
        .where(eq(schema.consentEvents.signupId, enrolled.id));
      expect(changes.map((row) => row.granted).sort()).toEqual([false, true]);
    }, 60000);

    it("legacy verification confirms enrollment but never creates authentication or marketing consent", async () => {
      const row = await legacySignup("legacy");
      const token = randomUUID();
      await db
        .insert(schema.verificationTokens)
        .values({
          signupId: row.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60000),
          requestedMarketingConsent: true,
        });
      const url = `https://preview.example.invalid/verify?token=${token}`;
      await expect(verify(new Request(url))).rejects.toThrow(
        "redirect:/waitlist?verification=confirmed"
      );
      expect((await record(address("legacy"))).status).toBe("confirmed");
      expect((await record(address("legacy"))).marketingConsent).toBe(false);
      expect(mocks.cookies.get(SESSION_COOKIE)).toBeUndefined();
      expect((await session()).status).toBe(401);
      expect((await csv()).status).toBe(404);
      await expect(verify(new Request(url))).rejects.toThrow(
        "redirect:/waitlist?verification=invalid"
      );
    }, 30000);

    it("legacy cookies and direct anonymous signup cannot enroll, administer, or alter consent", async () => {
      const row = await legacySignup("old-admin");
      await db
        .update(schema.waitlistSignups)
        .set({ status: "confirmed", accountRole: "admin" })
        .where(eq(schema.waitlistSignups.id, row.id));
      await db
        .insert(schema.adminRoleGrants)
        .values({ signupId: row.id, source: "synthetic_fixture" });
      const token = randomUUID();
      await db
        .insert(schema.sessions)
        .values({
          signupId: row.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60000),
        });
      mocks.cookies.set(SESSION_COOKIE, token);
      expect((await session()).status).toBe(401);
      expect((await csv()).status).toBe(404);
      expect(
        (
          await consent(
            request("/api/newsletter-consent", { newsletterOptIn: true }, "PUT")
          )
        ).status
      ).toBe(401);
      expect((await signup()).status).toBe(410);
      expect(await record(address("anonymous"))).toBeUndefined();
      expect(mocks.send).not.toHaveBeenCalled();
    }, 30000);

    it("unverified provider identities cannot claim membership and logout delegates to Auth0", async () => {
      await authenticate("unverified", false);
      expect((await session()).status).toBe(401);
      expect(await record(address("unverified"))).toBeUndefined();
      const result = await logout(request("/api/logout"));
      expect(result.status).toBe(303);
      expect(new URL(result.headers.get("location")!).pathname).toBe(
        "/auth/logout"
      );
    }, 30000);

    it("preserves durable legacy delivery retries without using email as session authority", async () => {
      const row = await legacySignup("retry");
      const [event] = await db
        .insert(schema.emailOutbox)
        .values({
          signupId: row.id,
          eventType: VERIFICATION_EMAIL_EVENT,
          idempotencyKey: `synthetic:${randomUUID()}`,
          payload: {
            to: row.email,
            verificationUrl:
              "https://preview.example.invalid/verify?token=synthetic",
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
        })
        .returning();
      mocks.send.mockRejectedValueOnce(
        new EmailProviderError("synthetic failure", true, "test_unavailable")
      );
      await dispatchOutboxEvent(event.id);
      const [failed] = await db
        .select()
        .from(schema.emailOutbox)
        .where(eq(schema.emailOutbox.id, event.id));
      expect(failed).toMatchObject({
        processedAt: null,
        attemptCount: 1,
        lastErrorCode: "test_unavailable",
      });
      expect((await outbox(request("/api/internal/outbox"))).status).toBe(401);
      await db
        .update(schema.emailOutbox)
        .set({ nextAttemptAt: new Date(0) })
        .where(eq(schema.emailOutbox.id, event.id));
      expect((await (await outbox(workerRequest())).json()).delivered).toBe(1);
      expect(mocks.send.mock.calls[0][0].idempotencyKey).toBe(
        mocks.send.mock.calls[1][0].idempotencyKey
      );
      const [delivered] = await db
        .select()
        .from(schema.emailOutbox)
        .where(eq(schema.emailOutbox.id, event.id));
      expect(delivered).toMatchObject({ payload: {}, attemptCount: 2 });
      expect(delivered.processedAt).toBeInstanceOf(Date);
    }, 30000);
  }
);
