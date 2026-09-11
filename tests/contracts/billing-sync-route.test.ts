import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  fetchUsage: vi.fn(),
  manifests: vi.fn(),
  record: vi.fn(),
  owner: vi.fn(),
  runs: vi.fn(),
}));
vi.mock("@/lib/console/session-user", () => ({
  requireConsoleSession: mocks.session,
}));
vi.mock("@/lib/console/manifest-usage", () => ({
  fetchManifestUsage: mocks.fetchUsage,
}));
vi.mock("@/lib/runs/store", () => ({
  ownedPaymentManifests: mocks.manifests,
  recordManifestUsage: mocks.record,
  resolveRunOwner: mocks.owner,
  ownedRunsByIds: mocks.runs,
}));
vi.mock("@/lib/runs/http", () => ({
  RUN_HEADERS: {},
  runError: (e: Error) =>
    Response.json(
      {},
      { status: e.message === "invalid_run_query" ? 400 : 503 }
    ),
}));
import { POST } from "@/app/api/console/runs/billing-sync/route";
const post = (ids: string[]) =>
  POST(
    new Request("https://test/api", {
      method: "POST",
      body: JSON.stringify({ runIds: ids }),
    })
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({
    externalUserId: "eu",
    canonicalUserId: "user",
  });
  mocks.owner.mockResolvedValue({
    userId: "user",
    externalAccountId: "account",
  });
  mocks.manifests.mockResolvedValue([
    {
      manifest: {
        manifestId: "mid",
        accepted: true,
        createdAt: new Date("2026-08-31"),
        observedAt: null,
      },
      status: "succeeded",
      updatedAt: new Date("2026-01-01"),
    },
  ]);
  mocks.fetchUsage.mockResolvedValue([
    { manifestId: "mid", networkFeeUsdMicros: "2982", feeWei: "123" },
    { manifestId: "unrelated", networkFeeUsdMicros: "999", feeWei: null },
  ]);
  mocks.record.mockResolvedValue(["run"]);
  mocks.runs.mockResolvedValue([]);
});
describe("manifest billing sync", () => {
  it("queries one lifetime aggregate interval and persists only exact owned manifests", async () => {
    const r = await post(["run"]);
    expect(await r.json()).toEqual({
      changedRunIds: ["run"],
      changedCount: 1,
      pending: false,
    });
    expect(mocks.fetchUsage).toHaveBeenCalledTimes(1);
    expect(mocks.fetchUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        externalUserId: "eu",
        startDate: "2026-08-01T00:00:00.000Z",
      })
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.anything(),
      ["run"],
      [{ manifestId: "mid", networkFeeUsdMicros: "2982", feeWei: "123" }],
      expect.any(Date)
    );
  });
  it("does not infer manifests for historical runs", async () => {
    mocks.manifests.mockResolvedValue([]);
    expect((await post(["old"])).status).toBe(200);
    expect(mocks.fetchUsage).not.toHaveBeenCalled();
  });
  it("retries when a running run has not yet reached payment", async () => {
    mocks.manifests.mockResolvedValue([]);
    mocks.runs.mockResolvedValue([{ status: "running" }]);
    expect((await (await post(["run"])).json()).pending).toBe(true);
  });
  it("keeps missing accepted usage pending without fabricating zero receipts", async () => {
    mocks.fetchUsage.mockResolvedValue([]);
    expect((await (await post(["run"])).json()).pending).toBe(true);
    expect(mocks.record.mock.calls[0][2]).toEqual([]);
  });
  it("does not repeatedly fetch a fresh terminal snapshot", async () => {
    mocks.manifests.mockResolvedValue([
      {
        manifest: { observedAt: new Date() },
        status: "succeeded",
        updatedAt: new Date("2026-01-01"),
      },
    ]);
    await post(["run"]);
    expect(mocks.fetchUsage).not.toHaveBeenCalled();
  });
  it("refreshes a recently completed run while final usage may still be arriving", async () => {
    mocks.manifests.mockResolvedValue([
      {
        manifest: { observedAt: new Date() },
        status: "succeeded",
        updatedAt: new Date(),
      },
    ]);
    expect((await (await post(["run"])).json()).pending).toBe(true);
  });
  it("rejects oversized requests and mismatched owners before upstream calls", async () => {
    expect(
      (await post(Array.from({ length: 51 }, (_, i) => String(i)))).status
    ).toBe(400);
    mocks.owner.mockResolvedValue({ userId: "foreign" });
    expect((await post(["run"])).status).toBe(503);
    expect(mocks.fetchUsage).not.toHaveBeenCalled();
  });
});
