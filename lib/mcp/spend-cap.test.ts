import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertSpendHeadroom,
  mergeSpendReport,
  resetSpendCap,
  setSpendCap,
} from "./spend-cap";
import type { PymthouseUsageSnapshot } from "./pymthouse-spend";

function usage(
  overrides: Partial<PymthouseUsageSnapshot> = {}
): PymthouseUsageSnapshot {
  return {
    period: {
      start: "2026-09-01T00:00:00.000Z",
      end: "2026-09-01T23:59:59.999Z",
    },
    requestCount: 4,
    networkFeeUsdMicros: "2800",
    spentUsd: 0.0028,
    remainingIncludedUsd: 5,
    hasAccess: true,
    ...overrides,
  };
}

test("mergeSpendReport uses PymtHouse network fee, not a local ledger", () => {
  resetSpendCap("eu_1");
  const report = mergeSpendReport("eu_1", usage());
  assert.equal(report.spentUsd, 0.0028);
  assert.equal(report.count, 4);
  assert.equal(report.source, "pymthouse");
});

test("assertSpendHeadroom allows sub-cent spend under the cap", () => {
  resetSpendCap("eu_1");
  assert.doesNotThrow(() =>
    assertSpendHeadroom(mergeSpendReport("eu_1", usage()))
  );
});

test("assertSpendHeadroom blocks when OpenMeter spend meets the cap", () => {
  resetSpendCap("eu_2");
  setSpendCap("eu_2", 0.002);
  assert.throws(
    () => assertSpendHeadroom(mergeSpendReport("eu_2", usage())),
    /spend_cap exceeded/
  );
});

test("assertSpendHeadroom blocks when PymtHouse spendable is exhausted", () => {
  resetSpendCap("eu_3");
  assert.throws(
    () =>
      assertSpendHeadroom(
        mergeSpendReport("eu_3", usage({ hasAccess: false }))
      ),
    /spendable is exhausted/
  );
});
