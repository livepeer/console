import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  authIdentities,
  accessGrants,
  accessEvents,
  externalAccounts,
  emailSubscriptions,
} from "./schema";
import {
  buildGrandfatherManifest,
  legacyExternalId,
  manifestSummary,
} from "../../scripts/early-access/manifest";
import { assertReviewedManifest } from "../../scripts/early-access/reconcile";

const sql = readFileSync(
  resolve(process.cwd(), "drizzle/0007_early_access_domains.sql"),
  "utf8"
);
const issuer = "https://login.example";
const subject = "auth0|synthetic-existing-user";
function input() {
  return {
    scope: {
      service: "pymthouse",
      issuer: "https://pymthouse.example/oidc",
      appId: "production-console",
    },
    auth0Issuer: issuer,
    cutoff: "2026-09-04T00:00:00.000Z",
    inventory: {
      users: [
        {
          id: "private-record",
          clientId: "production-console",
          externalUserId: legacyExternalId(subject),
          email: "synthetic@example.invalid",
          status: "active",
          role: "user",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    },
    evidence: [
      {
        subject,
        issuer,
        source: "console_authentication",
        occurredAt: "2026-09-02T00:00:00.000Z",
      },
    ],
  };
}
const uniqueColumns = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table)
    .indexes.filter((entry) => entry.config.unique)
    .map((entry) =>
      entry.config.columns.map((column) =>
        "name" in column ? column.name : String(column)
      )
    );

describe("early-access migration and grandfather planning", () => {
  it("keeps journal history and adds only0007", () => {
    const journal = JSON.parse(
      readFileSync(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8")
    );
    expect(journal.entries.at(-1).tag).toBe("0007_early_access_domains");
    expect(journal.entries).toHaveLength(8);
  });
  it("scopes identities/accounts and permits multiple accounts per user", () => {
    expect(authIdentities.externalUserId.notNull).toBe(false);
    expect(authIdentities.issuer.notNull).toBe(false);
    expect(uniqueColumns(authIdentities)).toContainEqual([
      "authority",
      "issuer",
      "provider_subject",
    ]);
    expect(uniqueColumns(externalAccounts)).toContainEqual([
      "service",
      "issuer",
      "app_id",
      "external_user_id",
    ]);
    expect(uniqueColumns(externalAccounts)).not.toContainEqual([
      "user_id",
      "service",
      "issuer",
      "app_id",
    ]);
  });
  it("defines separate approval and subscription uniqueness", () => {
    expect(uniqueColumns(accessGrants)).toContainEqual(["user_id"]);
    expect(uniqueColumns(accessGrants)).toContainEqual(["signup_id"]);
    expect(uniqueColumns(accessEvents)).toContainEqual([
      "grant_id",
      "grant_version",
    ]);
    expect(uniqueColumns(emailSubscriptions)).toContainEqual([
      "normalized_email",
      "purpose",
    ]);
  });
  it("never grants product access in schema migration and makes audits immutable", () => {
    expect(sql).not.toMatch(/INSERT INTO\s+(?:"?users"?|"?access_grants"?)\b/i);
    expect(sql).toContain("ON CONFLICT (signup_id, role) DO NOTHING");
    expect(sql).toContain("ON CONFLICT (normalized_email, purpose) DO NOTHING");
    expect(sql).toContain("BEFORE UPDATE OR DELETE ON access_events");
    expect(sql).toContain("BEFORE TRUNCATE ON access_events");
    expect(sql).toContain("legacy_consent_conflict");
  });
  it("maps actual Console evidence and emits sanitized summary", () => {
    const manifest = buildGrandfatherManifest(input());
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.unresolved).toEqual([]);
    assertReviewedManifest(manifest, manifest.manifestChecksum);
    expect(JSON.stringify(manifestSummary(manifest))).not.toContain(subject);
    expect(JSON.stringify(manifestSummary(manifest))).not.toContain(
      "synthetic@example.invalid"
    );
  });
  it("does not use email as identity evidence", () => {
    const fixture = input();
    fixture.evidence = [];
    const manifest = buildGrandfatherManifest(fixture);
    expect(manifest.entries).toEqual([]);
    expect(manifest.unresolved[0].reason).toBe(
      "missing_or_ambiguous_identity_evidence"
    );
    expect(() =>
      assertReviewedManifest(manifest, manifest.manifestChecksum)
    ).toThrow("Unresolved");
  });
  it("rejects another app, wrong issuer, inactive and duplicate accounts", () => {
    const wrongApp = input();
    wrongApp.inventory.users[0].clientId = "preview-console";
    expect(buildGrandfatherManifest(wrongApp).unresolved[0].reason).toBe(
      "wrong_app_scope"
    );
    const wrongIssuer = input();
    wrongIssuer.evidence[0].issuer = "https://attacker.example";
    expect(buildGrandfatherManifest(wrongIssuer).entries).toEqual([]);
    const inactive = input();
    inactive.inventory.users[0].status = "inactive";
    expect(buildGrandfatherManifest(inactive).unresolved[0].reason).toBe(
      "nonactive_account_requires_review"
    );
    const duplicate = input();
    duplicate.inventory.users.push({
      ...duplicate.inventory.users[0],
      id: "other-record",
    });
    expect(buildGrandfatherManifest(duplicate).unresolved).toHaveLength(2);
  });
  it("excludes accounts or evidence after cutoff", () => {
    const laterAccount = input();
    laterAccount.inventory.users[0].createdAt = "2026-09-05T00:00:00.000Z";
    expect(buildGrandfatherManifest(laterAccount).excludedAfterCutoff).toBe(1);
    const laterEvidence = input();
    laterEvidence.evidence[0].occurredAt = "2026-09-05T00:00:00.000Z";
    expect(buildGrandfatherManifest(laterEvidence).entries).toEqual([]);
  });
  it("rejects reviewed manifest alteration", () => {
    const manifest = buildGrandfatherManifest(input());
    const reviewed = manifest.manifestChecksum;
    manifest.entries[0].externalUserId = "eu_wrong";
    expect(() => assertReviewedManifest(manifest, reviewed)).toThrow(
      "checksum"
    );
  });
});
