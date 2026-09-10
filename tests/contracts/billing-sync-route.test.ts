import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  fetchRequests: vi.fn(),
  ownedRuns: vi.fn(),
  recordUsage: vi.fn(),
  resolveOwner: vi.fn(),
}));

vi.mock("@/lib/console/session-user", () => ({
  requireConsoleSession: mocks.session,
}));
vi.mock("@/lib/console/pymthouse-bff", () => ({
  fetchAccountRequestsForExternalUser: mocks.fetchRequests,
}));
vi.mock("@/lib/external-accounts/service", () => ({
  configuredPymthouseScope: () => ({ appId: "app_test" }),
}));
vi.mock("@/lib/runs/store", () => ({
  ownedRunsByIds: mocks.ownedRuns,
  recordRunUsage: mocks.recordUsage,
  resolveRunOwner: mocks.resolveOwner,
}));
vi.mock("@/lib/runs/http", () => ({
  RUN_HEADERS: { "cache-control": "no-store" },
  runError: (error: unknown) =>
    Response.json(
      { error: "request_failed" },
      { status: (error as Error).message === "invalid_run_query" ? 400 : 503 }
    ),
}));

import { POST } from "@/app/api/console/runs/billing-sync/route";

describe("POST /api/console/runs/billing-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({
      externalUserId: "eu_test",
      canonicalUserId: "user_test",
      email: "user@example.test",
    });
    mocks.resolveOwner.mockResolvedValue({
      principalId: "eu_test",
      userId: "user_test",
      externalAccountId: "account_test",
    });
    mocks.ownedRuns.mockResolvedValue([
      { id: "run_1", gatewayRequestId: "job_exact" },
    ]);
    mocks.recordUsage.mockResolvedValue(["run_1"]);
    mocks.fetchRequests.mockResolvedValue({
      items: [
        {
          eventId: "receipt_exact",
          gatewayRequestId: "job_exact",
          time: "2026-09-10T12:00:00Z",
          clientId: "app_test",
          externalUserId: "eu_test",
          pipeline: "fixed",
          modelId: "fal-ai/flux/schnell",
          networkFeeUsdMicros: "1.25",
          feeWei: "10",
          ethUsdPrice: "2000",
          pixels: "512",
        },
        {
          eventId: "receipt_nearby",
          gatewayRequestId: "abcd1234",
          time: "2026-09-10T12:00:01Z",
          clientId: "app_test",
          externalUserId: "eu_test",
          pipeline: "fixed",
          modelId: "fal-ai/flux/schnell",
          networkFeeUsdMicros: "99",
        },
      ],
      nextCursor: null,
      openMeterConfigured: true,
      clientId: "app_test",
      externalUserId: "eu_test",
    });
  });

  it("persists only exact owned gateway matches and returns changed run IDs", async () => {
    const response = await POST(
      new Request("http://localhost/api/console/runs/billing-sync", {
        method: "POST",
        body: JSON.stringify({ runIds: ["run_1", "foreign_run"] }),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      changedRunIds: ["run_1"],
      changedCount: 1,
    });
    expect(mocks.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ principalId: "eu_test" }),
      [
        {
          eventId: "receipt_exact",
          gatewayRequestId: "job_exact",
          metadata: {
            billingEventId: "receipt_exact",
            ticketGatewayRequestId: "job_exact",
            pipeline: "fixed",
            modelId: "fal-ai/flux/schnell",
            networkFeeUsdMicros: "1.25",
            feeWei: "10",
            ethUsdPrice: "2000",
            pixels: "512",
            timestamp: "2026-09-10T12:00:00.000Z",
          },
        },
      ]
    );
  });

  it("rejects more than 50 run IDs before upstream access", async () => {
    const response = await POST(
      new Request("http://localhost/api/console/runs/billing-sync", {
        method: "POST",
        body: JSON.stringify({
          runIds: Array.from({ length: 51 }, (_, index) => `run_${index}`),
        }),
      })
    );
    expect(response.status).toBe(400);
    expect(mocks.fetchRequests).not.toHaveBeenCalled();
  });
});
