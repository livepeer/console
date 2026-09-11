import { afterEach, expect, it, vi } from "vitest";
import { sanitizePublicMedia, publicRunDetail } from "@/lib/assets/public";
import { extractRunOutputs } from "@/lib/runs/outputs";
import type { RunDetail } from "@/lib/runs/types";
afterEach(() => vi.unstubAllEnvs());
it("removes input and redacted provider media while preserving prompts and unrelated links", () => {
  const url = "https://provider.example/a?token=[REDACTED]";
  const clean = sanitizePublicMedia(
    {
      inputs: {
        reference_image: url,
        mask_url: url,
        image_prompt: url,
        prompt: `paint ${url}`,
        website: "https://example.com",
        keyframes: [{ image_url: url }],
        images: [{ url, width: 20 }],
      },
      result: { video: { url } },
    },
    [],
    "eu_test"
  );
  expect(clean).toEqual({
    inputs: {
      image_prompt: url,
      prompt: `paint ${url}`,
      website: "https://example.com",
      keyframes: [{}],
      images: [{ width: 20 }],
    },
    result: { video: {} },
  });
});
it("rewrites owned media but removes unmatched media even with partial persistence", () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://preview.example");
  const assets = [{ id: "owned", url: "https://provider.example/a" }];
  const clean = sanitizePublicMedia(
    {
      images: [{ url: assets[0]!.url }, { url: "https://provider.example/b" }],
      reference_image: "https://preview.example/api/assets/owned?sig=old",
      mask_url: "https://evil.example/api/assets/owned",
      video_url: "https://preview.example/api/assets/foreign",
    },
    assets,
    "eu_test"
  );
  expect(JSON.stringify(clean)).not.toMatch(/provider|evil|foreign|sig=old/);
  expect(JSON.stringify(clean)).toContain(
    "https://preview.example/api/assets/owned?exp="
  );
});
it("strips provider queue URLs from public event keys and metadata", () => {
  const queue = "https://queue.fal.run/fal-ai/flux/requests/req-1/status";
  const relative = "//queue.fal.run/fal-ai/flux/requests/req-1/status";
  const bare = "queue.fal.run/fal-ai/flux/requests/req-1/status";
  const event = (
    id: string,
    eventKey: string,
    metadata: Record<string, unknown> = { providerStatus: "IN_QUEUE" }
  ) => ({
    id,
    eventKey,
    status: "running" as const,
    createdAt: "2026-09-11T00:00:00.000Z",
    metadata,
  });
  const clean = publicRunDetail({
    principalId: "eu_test",
    billing: { networkFeeUsdMicros: "2982", manifestCount: 1 },
    assets: [],
    submittedArguments: { prompt: "portrait" },
    result: { value: { text: "ok" } },
    events: [
      {
        ...event("evt_progress", `progress:IN_QUEUE:req-1:${queue}`),
        metadata: {
          providerStatus: "IN_QUEUE",
          queue: {
            statusUrl: queue,
            resultUrl: queue.replace(/\/status$/, ""),
          },
          recoveryHandle: queue,
        },
        runId: "run_hidden",
      },
      event("evt_empty_id", `progress:IN_QUEUE::${queue}`),
      event("evt_relative", `progress:IN_QUEUE:req-1:${relative}`),
      event("evt_bare", `progress:IN_QUEUE:req-1:${bare}`),
      {
        id: "evt_usage",
        eventKey: "usage:receipt",
        status: "succeeded",
        createdAt: "2026-09-11T00:00:01.000Z",
        metadata: {
          kind: "billing_usage",
          networkFeeUsdMicros: "2982",
          feeWei: "1",
          pipeline: "fal-ai/flux/schnell",
          modelId: "fal-ai/flux/schnell",
          reason: queue,
          providerStatus: `IN_QUEUE ${relative}`,
        },
      },
    ],
  } as unknown as RunDetail);
  expect(JSON.stringify(clean)).not.toMatch(
    /queue\.fal\.run|statusUrl|run_hidden/
  );
  expect(clean.events).toEqual([
    {
      id: "evt_progress",
      eventKey: "progress:IN_QUEUE:req-1",
      status: "running",
      createdAt: "2026-09-11T00:00:00.000Z",
      metadata: { providerStatus: "IN_QUEUE" },
    },
    {
      id: "evt_empty_id",
      eventKey: "progress:IN_QUEUE:",
      status: "running",
      createdAt: "2026-09-11T00:00:00.000Z",
      metadata: { providerStatus: "IN_QUEUE" },
    },
    {
      id: "evt_relative",
      eventKey: "progress:IN_QUEUE:req-1",
      status: "running",
      createdAt: "2026-09-11T00:00:00.000Z",
      metadata: { providerStatus: "IN_QUEUE" },
    },
    {
      id: "evt_bare",
      eventKey: "progress:IN_QUEUE:req-1",
      status: "running",
      createdAt: "2026-09-11T00:00:00.000Z",
      metadata: { providerStatus: "IN_QUEUE" },
    },
    {
      id: "evt_usage",
      eventKey: "usage:receipt",
      status: "succeeded",
      createdAt: "2026-09-11T00:00:01.000Z",
      metadata: {
        kind: "billing_usage",
        networkFeeUsdMicros: "2982",
        feeWei: "1",
        pipeline: "fal-ai/flux/schnell",
        modelId: "fal-ai/flux/schnell",
        providerStatus: "IN_QUEUE",
      },
    },
  ]);
});
it("keeps unavailable asset lineage and billing in public history", () => {
  const unavailableAt = "2026-09-11T00:00:00Z";
  const detail = {
    principalId: "eu_test",
    billing: { networkFeeUsdMicros: "2982", manifestCount: 1 },
    assets: [
      {
        id: "owned",
        url: "https://provider.example/a",
        unavailableAt,
        role: "output",
      },
    ],
    submittedArguments: { prompt: "portrait" },
    result: { value: { image_url: "https://provider.example/a" } },
  } as unknown as RunDetail;
  const clean = publicRunDetail(detail);
  expect(clean.assets[0]).toMatchObject({
    id: "owned",
    unavailableAt,
    role: "output",
  });
  expect(clean.billing).toEqual(detail.billing);
  expect(clean.submittedArguments).toEqual(detail.submittedArguments);
});
it("captures distinct explicit expiries, keeps availability guarantees separate, and leaves unknown expiry unknown", () => {
  const a = "2026-09-12T00:00:00.000Z",
    b = "2026-09-13T00:00:00.000Z";
  expect(
    extractRunOutputs({
      images: [
        { url: "https://p.example/a", expiresAt: a },
        { url: "https://p.example/b", available_until: b },
        { url: "https://p.example/c", expiresAt: "invalid" },
      ],
    })
  ).toEqual([
    { url: "https://p.example/a", mediaKind: "image", expiresAt: a },
    {
      url: "https://p.example/b",
      mediaKind: "image",
      availableUntil: b,
    },
    { url: "https://p.example/c", mediaKind: "image" },
  ]);
  expect(
    extractRunOutputs({ imageUrl: "https://p.example/a", expiresAt: a })[0]
      ?.expiresAt
  ).toBe(a);
});

it("strips provider URLs under generic output/data/result wrappers", () => {
  const url = "https://provider.example/file?token=secret";
  expect(
    sanitizePublicMedia(
      {
        output: url,
        data: url,
        result: url,
        nested: { output: { data: url } },
        prompt: `see ${url}`,
        text: url,
        website: "https://example.com",
      },
      [],
      "eu_test"
    )
  ).toEqual({
    nested: { output: {} },
    prompt: `see ${url}`,
    text: url,
    website: "https://example.com",
  });
});

it("strips compound provider URL keys including credentialed values", () => {
  const token = "https://v3.fal.media/files/x?token=secret";
  const queue = "https://queue.fal.run/fal-ai/flux/requests/id/status";
  expect(
    sanitizePublicMedia(
      {
        output_url: token,
        outputUrl: token,
        outputURL: token,
        preview_url: token,
        previewUrl: token,
        download_url: token,
        status_url: queue,
        statusUrl: queue,
        response_url: "https://queue.fal.run/fal-ai/flux/requests/id",
        responseURI: queue,
        asset2Url: token,
        prompt: `see ${token}`,
        website: "https://example.com",
      },
      [],
      "eu_test"
    )
  ).toEqual({ prompt: `see ${token}`, website: "https://example.com" });
});

it("drops unsupported 3D media URLs without removing ordinary model identifiers", () => {
  expect(
    sanitizePublicMedia(
      {
        model: "fal-ai/model",
        model_mesh: "ftp://provider.example/a.glb",
        textures: [
          "ftp://p.example/a.png",
          { url: "https://p.example/b?token=secret" },
        ],
        preview_image: { url: "https://p.example/c?token=secret" },
      },
      [],
      "eu_test"
    )
  ).toEqual({ model: "fal-ai/model", textures: [{}], preview_image: {} });
});
