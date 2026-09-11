import { expect, it } from "vitest";
import { devMockResponse } from "@/lib/console/dev-mock";
import type { RunSummary, RunDetail } from "@/lib/runs/types";
it("shares mock costs between summaries, details and events without billing network access", async () => {
  const response = devMockResponse(
    "/api/console/runs",
    new URLSearchParams(),
    "http://localhost:3000"
  );
  const { items } = (await response!.json()) as { items: RunSummary[] };
  for (const run of items) {
    const detail = (await devMockResponse(
      `/api/console/runs/${run.id}`,
      new URLSearchParams(),
      "http://localhost:3000"
    )!.json()) as RunDetail;
    expect(detail.billing).toEqual(run.billing);
    if (run.status === "succeeded")
      expect(
        detail.events.find((e) => e.metadata.kind === "billing_usage")?.metadata
          .networkFeeUsdMicros
      ).toBe(run.billing?.networkFeeUsdMicros);
  }
  expect(
    await devMockResponse(
      "/api/console/runs/billing-sync",
      new URLSearchParams(),
      "http://localhost:3000"
    )!.json()
  ).toMatchObject({ pending: false, changedCount: 0 });
});
