import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openIntegrationDatabase } from "@/tests/support/isolated-db";
import {
  buildGrandfatherManifest,
  legacyExternalId,
} from "../../scripts/early-access/manifest";
import { reconcileManifest } from "../../scripts/early-access/reconcile";

const databaseUrl = process.env.TEST_DATABASE_URL;
let client: ReturnType<typeof postgres>;
const journal = JSON.parse(
  readFileSync(
    path.resolve(process.cwd(), "drizzle/meta/_journal.json"),
    "utf8"
  )
) as { entries: Array<{ idx: number; tag: string }> };

describe.skipIf(!databaseUrl)(
  "domain migration against disposable Postgres",
  () => {
    beforeAll(async () => {
      ({ client } = await openIntegrationDatabase({
        TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
        TEST_DATABASE_HOST: process.env.TEST_DATABASE_HOST,
        TEST_DATABASE_BRANCH_ID: process.env.TEST_DATABASE_BRANCH_ID,
      }));
    });
    afterAll(async () => {
      await client?.end();
    });

    it("upgrades production0004 through0007, preserving records and enforcing invariants", async () => {
      const schema = `migration_${randomUUID().replaceAll("-", "")}`;
      const rollback = new Error("rollback_synthetic_migration_schema");
      try {
        await client.begin(async (tx) => {
          await tx.unsafe(`CREATE SCHEMA "${schema}"`);
          await tx.unsafe(`SET LOCAL search_path TO "${schema}", public`);
          async function apply(index: number) {
            const tag = journal.entries.find(
              (entry) => entry.idx === index
            )!.tag;
            const source = readFileSync(
              path.resolve(process.cwd(), `drizzle/${tag}.sql`),
              "utf8"
            );
            for (const statement of source.split("--> statement-breakpoint"))
              if (statement.trim())
                await tx.unsafe(
                  statement.replaceAll('"public".', `"${schema}".`)
                );
          }
          for (let i = 0; i <= 4; i++) await apply(i);
          const [conflict] =
            await tx`INSERT INTO waitlist_signups (email, normalized_email, referral_code, status, marketing_consent, first_touch, last_touch)
          VALUES ('conflict@example.invalid', 'conflict@example.invalid', 'fixture-conflict', 'confirmed', true, '{}', '{}') RETURNING id`;
          const [confirmed] =
            await tx`INSERT INTO waitlist_signups (email, normalized_email, referral_code, status, marketing_consent, account_role, first_touch, last_touch)
          VALUES ('confirmed@example.invalid', 'confirmed@example.invalid', 'fixture-confirmed', 'confirmed', true, 'admin', '{}', '{}') RETURNING id`;
          await tx`INSERT INTO waitlist_signups (email, normalized_email, referral_code, first_touch, last_touch)
          VALUES ('pending@example.invalid', 'pending@example.invalid', 'fixture-pending', '{}', '{}')`;
          await tx`INSERT INTO consent_events (signup_id, purpose, granted, disclosure_version, source)
          VALUES (${conflict.id}, 'product_marketing', false, 'fixture', 'fixture'),
          (${confirmed.id}, 'product_marketing', true, 'fixture', 'fixture')`;
          await apply(5);
          await apply(6);
          const [user] =
            await tx`INSERT INTO users DEFAULT VALUES RETURNING id`;
          const [identity] =
            await tx`INSERT INTO auth_identities (user_id, provider, provider_subject, external_user_id)
          VALUES (${user.id}, 'auth0', 'auth0|legacy-fixture', 'eu_original') RETURNING id`;
          await apply(7);
          expect((await tx`SELECT count(*)::int AS n FROM users`)[0].n).toBe(1);
          expect(
            (await tx`SELECT count(*)::int AS n FROM waitlist_signups`)[0].n
          ).toBe(3);
          expect(
            (await tx`SELECT count(*)::int AS n FROM consent_events`)[0].n
          ).toBe(2);
          expect(
            (await tx`SELECT count(*)::int AS n FROM access_grants`)[0].n
          ).toBe(0);
          expect(
            (await tx`SELECT count(*)::int AS n FROM admin_role_grants`)[0].n
          ).toBe(1);
          expect(
            (
              await tx`SELECT status, source FROM email_subscriptions WHERE signup_id = ${conflict.id}`
            )[0]
          ).toMatchObject({
            status: "unsubscribed",
            source: "legacy_consent_conflict",
          });
          expect(
            (
              await tx`SELECT status FROM email_subscriptions WHERE signup_id = ${confirmed.id}`
            )[0].status
          ).toBe("subscribed");
          expect(
            (
              await tx`SELECT count(*)::int AS n FROM consent_events WHERE subscription_id IS NOT NULL`
            )[0].n
          ).toBe(2);
          // Rerun the data backfills alone: no duplicated subscriptions/admins/history.
          const migration = readFileSync(
            path.resolve(
              process.cwd(),
              "drizzle/0007_early_access_domains.sql"
            ),
            "utf8"
          );
          for (const block of migration.split("--> statement-breakpoint"))
            if (
              /INSERT INTO admin_role_grants|WITH purposes AS|UPDATE consent_events e SET/.test(
                block
              )
            )
              await tx.unsafe(block);
          expect(
            (await tx`SELECT count(*)::int AS n FROM email_subscriptions`)[0].n
          ).toBe(3);
          expect(
            (await tx`SELECT count(*)::int AS n FROM admin_role_grants`)[0].n
          ).toBe(1);

          await expect(
            tx.savepoint(async (sp) => {
              await sp`UPDATE auth_identities SET external_user_id = 'eu_replaced' WHERE id = ${identity.id}`;
            })
          ).rejects.toMatchObject({ code: "23514" });
          await tx`INSERT INTO auth_identities (user_id, authority, issuer, provider, provider_subject)
          VALUES (${user.id}, 'test', 'https://one.example', 'test', 'same-sub'),
          (${user.id}, 'test', 'https://two.example', 'test', 'same-sub')`;
          await expect(
            tx.savepoint(async (sp) => {
              await sp`INSERT INTO auth_identities (user_id, authority, issuer, provider, provider_subject)
            VALUES (${user.id}, 'test', 'https://one.example', 'test', 'same-sub')`;
            })
          ).rejects.toMatchObject({ code: "23505" });
          await tx`INSERT INTO external_accounts (user_id, service, issuer, app_id, external_user_id, source)
          VALUES (${user.id}, 'pymthouse', 'https://billing.example', 'app', 'eu_first', 'fixture'),
          (${user.id}, 'pymthouse', 'https://billing.example', 'app', 'eu_second', 'fixture')`;
          expect(
            (
              await tx`SELECT count(*)::int AS n FROM external_accounts WHERE user_id = ${user.id}`
            )[0].n
          ).toBe(2);
          await expect(
            tx.savepoint(async (sp) => {
              await sp`INSERT INTO external_accounts (user_id, service, issuer, app_id, external_user_id, source)
            VALUES (${user.id}, 'pymthouse', 'https://billing.example', 'app', 'eu_first', 'fixture')`;
            })
          ).rejects.toMatchObject({ code: "23505" });
          await expect(
            tx.savepoint(async (sp) => {
              await sp`INSERT INTO access_grants (status, source) VALUES ('approved', 'invalid')`;
            })
          ).rejects.toMatchObject({ code: "23514" });
          const [grant] =
            await tx`INSERT INTO access_grants (user_id, status, source) VALUES (${user.id}, 'approved', 'fixture') RETURNING id`;
          await tx`INSERT INTO access_events (grant_id, action, source, next_status, grant_version)
          VALUES (${grant.id}, 'approve', 'fixture', 'approved', 1)`;
          for (const mutation of [
            "UPDATE access_events SET source = 'changed'",
            "DELETE FROM access_events",
            "TRUNCATE access_events CASCADE",
          ]) {
            await expect(
              tx.savepoint(async (sp) => {
                await sp.unsafe(mutation);
              })
            ).rejects.toMatchObject({ code: "23514" });
          }
          await expect(
            tx.savepoint(async (sp) => {
              await sp`INSERT INTO access_grants (user_id, status, source) VALUES (${user.id}, 'approved', 'duplicate')`;
            })
          ).rejects.toMatchObject({ code: "23505" });

          const subject = "auth0|reviewed-existing-console";
          const manifest = buildGrandfatherManifest({
            scope: {
              service: "pymthouse",
              issuer: "https://billing.example",
              appId: "app",
            },
            auth0Issuer: "https://auth.example",
            cutoff: "2026-09-04T00:00:00.000Z",
            inventory: {
              users: [
                {
                  id: "synthetic-pymthouse",
                  clientId: "app",
                  externalUserId: legacyExternalId(subject),
                  email: null,
                  status: "active",
                  role: "user",
                  createdAt: "2026-09-01T00:00:00.000Z",
                },
              ],
            },
            evidence: [
              {
                subject,
                issuer: "https://auth.example",
                source: "console_authentication",
                occurredAt: "2026-09-02T00:00:00.000Z",
              },
            ],
          });
          // Rehearsal transaction nests as a savepoint so the outer DDL also rolls back.
          const nested = {
            begin: tx.savepoint.bind(tx),
          } as unknown as typeof client;
          const dryRun = await reconcileManifest(nested, manifest, {
            reviewedChecksum: manifest.manifestChecksum,
          });
          expect(dryRun).toMatchObject({
            identitiesCreated: 1,
            accountsCreated: 1,
            grantsCreated: 1,
            blockers: 0,
          });
          expect((await tx`SELECT count(*)::int AS n FROM users`)[0].n).toBe(1);
          const applied = await reconcileManifest(nested, manifest, {
            reviewedChecksum: manifest.manifestChecksum,
            apply: true,
          });
          expect(applied.grantsCreated).toBe(1);
          const repeated = await reconcileManifest(nested, manifest, {
            reviewedChecksum: manifest.manifestChecksum,
            apply: true,
          });
          expect(repeated).toMatchObject({
            identitiesCreated: 0,
            accountsCreated: 0,
            grantsCreated: 0,
            blockers: 0,
          });
          await tx`UPDATE access_grants SET status = 'revoked' WHERE source = 'existing_console_user'`;
          const revoked = await reconcileManifest(nested, manifest, {
            reviewedChecksum: manifest.manifestChecksum,
            apply: true,
          });
          expect(revoked.blockers).toBe(1);
          expect(
            (
              await tx`SELECT status FROM access_grants WHERE source = 'existing_console_user'`
            )[0].status
          ).toBe("revoked");
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
      expect(
        (
          await client`SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name = ${schema}`
        )[0].n
      ).toBe(0);
    }, 60000);
  }
);
