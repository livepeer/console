import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertSpendable,
  usageSnapshotFromPayload,
  type PymthouseUsageSnapshot,
} from "./pymthouse-usage";

function payload(
  overrides: {
    networkFeeUsdMicros?: string;
    requestCount?: number;
    balance?: { balanceUsdMicros: string; hasAccess: boolean } | null;
  } = {}
) {
  return {
    period: {
      start: "2026-09-01T00:00:00.000Z",
      end: "2026-09-01T23:59:59.999Z",
    },
    current: {
      requestCount: overrides.requestCount ?? 4,
      networkFeeUsdMicros: overrides.networkFeeUsdMicros ?? "2800",
    },
    balance:
      overrides.balance === undefined
        ? { balanceUsdMicros: "5000000", hasAccess: true }
        : overrides.balance,
  };
}

test("usageSnapshotFromPayload uses PymtHouse network fee, not a local ledger", () => {
  const report = usageSnapshotFromPayload(payload());
  assert.equal(report.spentUsd, 0.0028);
  assert.equal(report.requestCount, 4);
  assert.equal(report.remainingIncludedUsd, 5);
  assert.equal(report.hasAccess, true);
  assert.equal(report.source, "pymthouse");
});

test("usageSnapshotFromPayload treats missing balance as not spendable", () => {
  const report = usageSnapshotFromPayload(payload({ balance: null }));
  assert.equal(report.hasAccess, false);
  assert.equal(report.remainingIncludedUsd, 0);
});

test("assertSpendable allows when PymtHouse hasAccess is true", () => {
  const usage: PymthouseUsageSnapshot = usageSnapshotFromPayload(payload());
  assert.doesNotThrow(() => assertSpendable(usage));
});

test("assertSpendable blocks when PymtHouse spendable is exhausted", () => {
  assert.throws(
    () =>
      assertSpendable(
        usageSnapshotFromPayload(
          payload({ balance: { balanceUsdMicros: "0", hasAccess: false } })
        )
      ),
    /spendable is exhausted/
  );
});

test("assertSpendable blocks when balance is unknown", () => {
  assert.throws(
    () => assertSpendable(usageSnapshotFromPayload(payload({ balance: null }))),
    /spendable is exhausted/
  );
});
