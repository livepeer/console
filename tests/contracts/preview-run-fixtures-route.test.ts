import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  ownedRuns: vi.fn(),
  createRun: vi.fn(),
  transitionRun: vi.fn(),
  recordUsage: vi.fn(),
}));

vi.mock("@/lib/runs/http", () => ({
  requireRunOwner: mocks.owner,
  RUN_HEADERS: { "cache-control": "no-store" },
  runError: () => Response.json({ error: "failed" }, { status: 500 }),
}));
vi.mock("@/lib/runs/store", () => ({
  withPreviewRunFixtures: async (
    _owner: unknown,
    work: (store: unknown) => unknown
  ) =>
    work({
      completedRunIds: async () => [],
      ownedRunsByIds: mocks.ownedRuns,
      createRun: mocks.createRun,
      transitionRun: mocks.transitionRun,
      recordRunUsage: mocks.recordUsage,
    }),
  ownedRunsByIds: mocks.ownedRuns,
  createRun: mocks.createRun,
  transitionRun: mocks.transitionRun,
  recordRunUsage: mocks.recordUsage,
}));

import { POST } from "@/app/api/console/runs/preview-fixtures/route";

describe("POST /api/console/runs/preview-fixtures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("CONSOLE_PREVIEW_FIXTURES", "1");
    mocks.owner.mockResolvedValue({
      principalId: "eu_preview",
      userId: "user_preview",
      externalAccountId: "account_preview",
    });
    mocks.ownedRuns.mockResolvedValue([]);
    mocks.createRun.mockImplementation(async (_owner, input) => ({
      id: input.id,
    }));
    mocks.transitionRun.mockResolvedValue({});
    mocks.recordUsage.mockResolvedValue([]);
  });

  it("is unavailable outside an explicitly enabled Vercel preview", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const response = await POST(
      new Request("https://console.example/api/console/runs/preview-fixtures", {
        method: "POST",
      })
    );
    expect(response.status).toBe(404);
    expect(mocks.owner).not.toHaveBeenCalled();
  });

  it("creates owner-scoped Neon fixtures with exact receipt joins and lineage", async () => {
    const response = await POST(
      new Request("https://preview.example/api/console/runs/preview-fixtures", {
        method: "POST",
      })
    );
    expect(response.status).toBe(200);
    expect((await response.json()).createdCount).toBe(4);
    expect(mocks.createRun).toHaveBeenCalledTimes(4);
    expect(mocks.transitionRun).toHaveBeenCalledTimes(4);
    expect(mocks.recordUsage).toHaveBeenCalledTimes(3);
    expect(mocks.recordUsage.mock.calls.flatMap((call) => call[1])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gatewayRequestId: expect.stringContaining("job_preview_"),
          metadata: expect.objectContaining({ networkFeeUsdMicros: "1000.25" }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({ networkFeeUsdMicros: "2000.75" }),
        }),
      ])
    );
    expect(JSON.stringify(mocks.createRun.mock.calls)).toContain(
      "/api/assets/asset_preview_"
    );
  });
});
