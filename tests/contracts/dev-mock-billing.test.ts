import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

it("serves every mock asset locally and never falls through for unknown IDs", async () => {
  const { items } = (await devMockResponse(
    "/api/console/runs",
    new URLSearchParams(),
    "http://localhost:3000"
  )!.json()) as { items: RunSummary[] };
  for (const run of items) {
    const detail = (await devMockResponse(
      `/api/console/runs/${run.id}`,
      new URLSearchParams(),
      "http://localhost:3000"
    )!.json()) as RunDetail;
    for (const asset of detail.assets) {
      const reply = devMockResponse(
        new URL(asset.url).pathname,
        new URLSearchParams(),
        "http://localhost:3000"
      )!;
      expect(reply.status).toBe(307);
      expect(new URL(reply.headers.get("location")!).origin).toBe(
        "http://localhost:3000"
      );
      expect(
        existsSync(
          join(
            process.cwd(),
            "public",
            new URL(reply.headers.get("location")!).pathname
          )
        )
      ).toBe(true);
    }
  }
  expect(
    devMockResponse(
      "/api/assets/unknown",
      new URLSearchParams(),
      "http://localhost:3000"
    )!.status
  ).toBe(404);
});

it("bundles valid audio and model fixture containers", () => {
  expect(
    readFileSync("public/fixtures/history/sample-tone.wav")
      .subarray(0, 4)
      .toString()
  ).toBe("RIFF");
  const glb = readFileSync("public/fixtures/history/octahedron.glb");
  expect(glb.subarray(0, 4).toString()).toBe("glTF");
  expect(glb.readUInt32LE(8)).toBe(glb.length);
});
