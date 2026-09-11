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
