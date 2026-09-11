import assert from "node:assert/strict";
import { test } from "node:test";

import { runToActivity } from "./run-activity";
import type { RunSummary } from "@/lib/runs/types";

function summary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    id: "run_1",
    principalId: "external",
    userId: "user",
    externalAccountId: "account",
    gatewayRequestId: "job_abc",
    providerRequestId: null,
    provider: null,
    source: "mcp",
    capability: "livepeer-example/fal-ideogram-v4",
    modelId: "livepeer-example/fal-ideogram-v4",
    endpoint: null,
    status: "succeeded",
    captureVersion: 1,
    errorCode: null,
    errorMessage: null,
    version: 1,
    createdAt: "2026-09-08T18:00:00Z",
    updatedAt: "2026-09-08T18:00:01Z",
    startedAt: "2026-09-08T18:00:00Z",
    completedAt: "2026-09-08T18:00:01Z",
    email: null,
    billing: null,
    ...overrides,
  };
}

test("run history stays em-dash when no billing receipt is joined", () => {
  const row = runToActivity(summary());
  assert.equal(row.costDisplay, "—");
  assert.equal(row.costExact, undefined);
});

test("run history formats its persisted billing summary", () => {
  const row = runToActivity(
    summary({ billing: { networkFeeUsdMicros: "1000", receiptCount: 1 } })
  );
  assert.equal(row.costDisplay, "$0.0010");
  assert.equal(row.costExact, "$0.001");
});

test("multiple persisted receipts use their decimal-safe aggregate", () => {
  const row = runToActivity(
    summary({ billing: { networkFeeUsdMicros: "3000", receiptCount: 2 } })
  );
  assert.equal(row.costDisplay, "$0.0030");
  assert.equal(row.costExact, "$0.003");
});
