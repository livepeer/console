import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchRange: vi.fn(),
  manifests: vi.fn(),
  record: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/console/manifest-usage", () => ({
  fetchManifestUsage: mocks.fetchRange,
}));
vi.mock("@/lib/runs/store", () => ({
  ownedPaymentManifests: mocks.manifests,
  recordManifestUsage: mocks.record,
  ownedRunsByIds: vi.fn(),
}));
import { refreshOwnedRunBillingByJob } from "@/lib/runs/manifest-billing";

const owner = {
  principalId: "eu",
  userId: "user",
  externalAccountId: "account",
};
const input = {
  owner,
  runId: "run_test",
  externalUserId: "eu",
  now: new Date("2026-09-11T12:00:00.000Z"),
  retryDelayMs: 0,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.manifests.mockResolvedValue([
    {
      manifest: {
        manifestId: "mid",
        accepted: true,
        createdAt: new Date("2026-09-11T11:55:00.000Z"),
        networkFeeUsdMicros: null,
      },
    },
  ]);
  mocks.fetchRange.mockResolvedValue([
    { manifestId: "mid", networkFeeUsdMicros: "2982", feeWei: "123" },
    { manifestId: "other", networkFeeUsdMicros: "119005", feeWei: null },
  ]);
  mocks.record.mockResolvedValue(["run_test"]);
});

it("persists the exact owned manifest and ignores other jobs in the window", async () => {
  expect(await refreshOwnedRunBillingByJob(input)).toEqual({
    changedRunIds: ["run_test"],
    pending: false,
  });
  expect(mocks.fetchRange).toHaveBeenCalledTimes(1);
  expect(mocks.fetchRange).toHaveBeenCalledWith({
    externalUserId: "eu",
    startDate: "2026-09-11T11:54:00.000Z",
    endDate: "2026-09-11T12:00:00.000Z",
  });
  expect(mocks.record).toHaveBeenCalledWith(
    owner,
    ["run_test"],
    [{ manifestId: "mid", networkFeeUsdMicros: "2982", feeWei: "123" }],
    input.now
  );
});

it("does not call PymtHouse when the run has no accepted manifest", async () => {
  mocks.manifests.mockResolvedValue([]);
  expect(await refreshOwnedRunBillingByJob(input)).toEqual({
    changedRunIds: [],
    pending: false,
  });
  expect(mocks.fetchRange).not.toHaveBeenCalled();
});

it("stamps each accepted manifest from the same run without using a job total", async () => {
  mocks.manifests.mockResolvedValue([
    {
      manifest: {
        manifestId: "a",
        accepted: true,
        createdAt: new Date("2026-09-11T11:55:00.000Z"),
      },
    },
    {
      manifest: {
        manifestId: "b",
        accepted: true,
        createdAt: new Date("2026-09-11T11:55:01.000Z"),
      },
    },
  ]);
  mocks.fetchRange.mockResolvedValue([
    { manifestId: "a", networkFeeUsdMicros: "1000", feeWei: null },
    { manifestId: "b", networkFeeUsdMicros: "2000", feeWei: null },
  ]);
  expect(await refreshOwnedRunBillingByJob(input)).toEqual({
    changedRunIds: ["run_test"],
    pending: false,
  });
  expect(mocks.record).toHaveBeenCalledWith(
    owner,
    ["run_test"],
    [
      { manifestId: "a", networkFeeUsdMicros: "1000", feeWei: null },
      { manifestId: "b", networkFeeUsdMicros: "2000", feeWei: null },
    ],
    input.now
  );
});

it("retries until the exact manifest appears instead of requiring History", async () => {
  mocks.fetchRange
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { manifestId: "mid", networkFeeUsdMicros: "2982", feeWei: "123" },
    ]);
  expect(await refreshOwnedRunBillingByJob(input)).toEqual({
    changedRunIds: ["run_test"],
    pending: false,
  });
  expect(mocks.fetchRange).toHaveBeenCalledTimes(2);
});

it("stays pending when the exact manifest is still missing", async () => {
  mocks.fetchRange.mockResolvedValue([]);
  expect(await refreshOwnedRunBillingByJob(input)).toEqual({
    changedRunIds: [],
    pending: true,
  });
  expect(mocks.fetchRange).toHaveBeenCalledTimes(3);
  expect(mocks.record).not.toHaveBeenCalled();
});
