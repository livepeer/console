import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql, eq } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import { openIntegrationDatabase } from "@/tests/support/isolated-db";
import * as schema from "@/lib/db/schema";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/external-accounts/service", () => ({
  configuredPymthouseScope: () => ({
    service: "pymthouse",
    issuer: "https://issuer.invalid",
    appId: "run-tests",
  }),
  findExternalAccountOwner: vi.fn(),
}));
import { getDb } from "@/lib/db";
import { ensurePreviewRunFixtures } from "@/lib/runs/preview-fixtures";
import {
  createRun,
  transitionRun,
  withPreviewRunFixtures,
} from "@/lib/runs/store";

it.skipIf(!process.env.TEST_DATABASE_URL)(
  "serializes fixture seeding, rolls back failures, and repairs partial owner-scoped fixtures",
  async () => {
    const { client } = await openIntegrationDatabase(process.env);
    const db = drizzle(client, { schema });
    const namespace = `fixture_${randomUUID().replaceAll("-", "")}`;
    const transaction: typeof db.transaction = (work, config) =>
      db.transaction(async (tx) => {
        await tx.execute(
          sql.raw(`SET LOCAL search_path TO "${namespace}", public`)
        );
        return work(tx);
      }, config);
    try {
      await db.execute(sql.raw(`CREATE SCHEMA "${namespace}"`));
      await transaction(async (tx) => {
        const journal = JSON.parse(
          readFileSync("drizzle-baseline/meta/_journal.json", "utf8")
        );
        for (const { tag } of journal.entries)
          for (const statement of readFileSync(
            `drizzle-baseline/${tag}.sql`,
            "utf8"
          ).split("--> statement-breakpoint"))
            if (statement.trim())
              await tx.execute(
                sql.raw(statement.replaceAll('"public".', `"${namespace}".`))
              );
      });
      vi.mocked(getDb).mockReturnValue({ ...db, transaction } as typeof db);
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("CONSOLE_PREVIEW_FIXTURES", "1");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://preview.example");
      const makeOwner = async (principalId: string) =>
        transaction(async (tx) => {
          const [user] = await tx.insert(schema.users).values({}).returning();
          const [account] = await tx
            .insert(schema.externalAccounts)
            .values({
              userId: user!.id,
              externalUserId: principalId,
              service: "pymthouse",
              issuer: "https://issuer.invalid",
              appId: "run-tests",
              source: "test",
            })
            .returning();
          return {
            principalId,
            userId: user!.id,
            externalAccountId: account!.id,
          };
        });
      const owner = await makeOwner("eu_fixture_one"),
        other = await makeOwner("eu_fixture_two");
      const suffix = createHash("sha256")
        .update(owner.principalId)
        .digest("hex")
        .slice(0, 12);
      const id = `run_preview_v2_${suffix}_portrait`;
      const input = {
        id,
        gatewayRequestId: `job_preview_v2_${suffix}_portrait`,
        capability: "fal-ai/flux/schnell",
        submittedArguments: { inputs: { prompt: "preserved" } },
      };
      await expect(
        withPreviewRunFixtures(owner, async (store) => {
          await store.createRun(owner, input);
          throw Error("injected_failure");
        })
      ).rejects.toThrow("injected_failure");
      expect(
        await transaction((tx) => tx.select().from(schema.runs))
      ).toHaveLength(0);
      await createRun(owner, input);
      await transitionRun(owner, id, {
        eventKey: "dispatch-returned",
        status: "succeeded",
        result: { value: { text: "preserved result" } },
      });
      const results = await Promise.all([
        ensurePreviewRunFixtures(owner, "https://preview.example"),
        ensurePreviewRunFixtures(owner, "https://preview.example"),
      ]);
      expect(results.map((r) => r.createdCount).sort()).toEqual([0, 3]);
      expect(
        (await ensurePreviewRunFixtures(owner, "https://preview.example"))
          .createdCount
      ).toBe(0);
      await ensurePreviewRunFixtures(other, "https://preview.example");
      await transaction(async (tx) => {
        expect(await tx.select().from(schema.runs)).toHaveLength(8);
        const receipts = await tx.select().from(schema.runUsageReceipts);
        expect(receipts).toHaveLength(8);
        const assets = await tx.select().from(schema.mcpAssets);
        expect(assets).toHaveLength(4);
        const links = await tx.select().from(schema.runAssetLinks);
        expect(links).toHaveLength(6);
        const [original] = await tx
          .select()
          .from(schema.runs)
          .where(eq(schema.runs.id, id));
        expect(original!.submittedArguments).toEqual(input.submittedArguments);
        expect(original!.result).toEqual({
          value: { text: "preserved result" },
        });
        expect(
          assets.filter((a) => a.principalId === owner.principalId)
        ).toHaveLength(2);
      });
      const expiry = "2026-12-01T00:00:00.000Z";
      const captured = {
        id: `asset_preview_v2_${suffix}_portrait`,
        url: "https://preview.example/images/console/explore/flux-schnell.webp",
        mediaType: "image/webp",
      };
      await withPreviewRunFixtures(owner, (store) =>
        store.transitionRun(owner, id, {
          eventKey: "dispatch-returned",
          status: "succeeded",
          assets: [{ ...captured, expiresAt: expiry }],
        })
      );
      await withPreviewRunFixtures(owner, (store) =>
        store.transitionRun(owner, id, {
          eventKey: "dispatch-returned",
          status: "succeeded",
          assets: [captured],
        })
      );
      await transaction(async (tx) => {
        const [asset] = await tx
          .select()
          .from(schema.mcpAssets)
          .where(eq(schema.mcpAssets.id, captured.id));
        expect(asset!.expiresAt?.toISOString()).toBe(expiry);
      });
      vi.stubEnv("VERCEL_ENV", "production");
      await expect(
        ensurePreviewRunFixtures(owner, "https://preview.example")
      ).rejects.toThrow("preview_fixtures_disabled");
    } finally {
      vi.unstubAllEnvs();
      await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`));
      await client.end();
    }
  },
  90000
);
