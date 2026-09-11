import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/assets/transport", () => ({ fetchPinnedAsset: vi.fn() }));
import { fetchPinnedAsset } from "@/lib/assets/transport";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("@/lib/mcp/store", () => ({ getAssetSource: vi.fn() }));

import { lookup } from "node:dns/promises";
import { getAssetSource } from "@/lib/mcp/store";
import { GET, HEAD } from "@/app/api/assets/[id]/route";
import { publicAssetUrl } from "@/lib/assets/public";

describe("first-party asset proxy", () => {
  beforeEach(() => {
    vi.mocked(lookup).mockReset();
    vi.mocked(fetchPinnedAsset).mockReset();
    vi.mocked(getAssetSource).mockReset();
    vi.unstubAllGlobals();
  });

  it("streams stored media and preserves byte-range requests", async () => {
    vi.mocked(getAssetSource).mockResolvedValue({
      url: "https://media.example.test/video.mp4",
      mediaType: "video",
      principalId: "eu_test",
      unavailableAt: null,
      expiresAt: null,
    });
    vi.mocked(lookup).mockResolvedValue([
      { address: "203.0.113.10", family: 4 },
    ] as never);
    const fetcher = vi.fn().mockResolvedValue(
      new Response("bytes", {
        status: 206,
        headers: {
          "content-type": "video/mp4",
          "content-range": "bytes 0-4/10",
        },
      })
    );
    vi.mocked(fetchPinnedAsset).mockImplementation(fetcher);

    const response = await GET(
      new Request(publicAssetUrl("asset_123", "eu_test"), {
        headers: { Range: "bytes=0-4" },
      }),
      { params: Promise.resolve({ id: "asset_123" }) }
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(await response.text()).toBe("bytes");
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://media.example.test/video.mp4"),
      [{ address: "203.0.113.10", family: 4 }],
      expect.objectContaining({
        headers: expect.objectContaining({
          Range: "bytes=0-4",
          "Accept-Encoding": "identity",
        }),
      })
    );
  });

  it("refuses asset origins that resolve to a private address", async () => {
    vi.mocked(getAssetSource).mockResolvedValue({
      url: "https://media.example.test/video.mp4",
      mediaType: "video",
      principalId: "eu_test",
      unavailableAt: null,
      expiresAt: null,
    });
    vi.mocked(lookup).mockResolvedValue([
      { address: "127.0.0.1", family: 4 },
    ] as never);
    const fetcher = vi.fn();
    vi.mocked(fetchPinnedAsset).mockImplementation(fetcher);

    const response = await GET(
      new Request(publicAssetUrl("asset_123", "eu_test")),
      { params: Promise.resolve({ id: "asset_123" }) }
    );

    expect(response.status).toBe(502);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns the same non-revealing 404 for missing and tampered signatures", async () => {
    vi.mocked(getAssetSource).mockResolvedValue({
      url: "https://media.example.test/video.mp4",
      mediaType: "video",
      principalId: "eu_test",
      unavailableAt: null,
      expiresAt: null,
    });
    const signed = new URL(publicAssetUrl("asset_123", "eu_test"));
    signed.searchParams.set("sig", "tampered");
    const response = await GET(new Request(signed), {
      params: Promise.resolve({ id: "asset_123" }),
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("treats stored expiresAt as a hard expiry", async () => {
    vi.mocked(getAssetSource).mockResolvedValue({
      url: "https://media.example.test/video.mp4",
      mediaType: "video",
      principalId: "eu_test",
      unavailableAt: null,
      expiresAt: new Date(Date.now() - 1),
    });
    const response = await GET(
      new Request(publicAssetUrl("asset_123", "eu_test")),
      { params: Promise.resolve({ id: "asset_123" }) }
    );
    expect(response.status).toBe(404);
  });

  it("revalidates redirect destinations against the provider allowlist", async () => {
    vi.mocked(getAssetSource).mockResolvedValue({
      url: "https://media.example.test/video.mp4",
      mediaType: "video",
      principalId: "eu_test",
      unavailableAt: null,
      expiresAt: null,
    });
    vi.mocked(lookup).mockResolvedValue([
      { address: "203.0.113.10", family: 4 },
    ] as never);
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/file" },
      })
    );
    vi.mocked(fetchPinnedAsset).mockImplementation(fetcher);
    const response = await GET(
      new Request(publicAssetUrl("asset_123", "eu_test")),
      { params: Promise.resolve({ id: "asset_123" }) }
    );
    expect(response.status).toBe(502);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

const source = {
  url: "https://media.example.test/a.png",
  principalId: "eu_test",
  mediaType: "image",
  expiresAt: null,
  unavailableAt: null,
};
const context = { params: Promise.resolve({ id: "asset_123" }) };
const signedRequest = (method = "GET") =>
  new Request(publicAssetUrl("asset_123", "eu_test"), { method });

it("does not resolve or fetch unavailable media", async () => {
  vi.mocked(lookup).mockClear();
  vi.mocked(fetchPinnedAsset).mockClear();
  vi.mocked(getAssetSource).mockResolvedValue({
    ...source,
    unavailableAt: new Date(),
  });
  expect((await GET(signedRequest(), context)).status).toBe(404);
  expect(lookup).not.toHaveBeenCalled();
  expect(fetchPinnedAsset).not.toHaveBeenCalled();
});
it.each([
  "10.0.0.1",
  "169.254.169.254",
  "100.64.0.1",
  "::1",
  "fc00::1",
  "::ffff:7f00:1",
  "::ffff:127.0.0.1",
  "fe80::1",
])("rejects mixed public/private DNS results including %s", async (address) => {
  vi.mocked(getAssetSource).mockResolvedValue(source);
  vi.mocked(fetchPinnedAsset).mockClear();
  vi.mocked(lookup).mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
    { address, family: address.includes(":") ? 6 : 4 },
  ] as never);
  expect((await GET(signedRequest(), context)).status).toBe(502);
  expect(fetchPinnedAsset).not.toHaveBeenCalled();
});
it("pins every redirect, cancels abandoned bodies, and bounds the redirect count", async () => {
  vi.mocked(getAssetSource).mockResolvedValue(source);
  vi.mocked(lookup).mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
  ] as never);
  const cancel = vi.fn();
  vi.mocked(fetchPinnedAsset)
    .mockReset()
    .mockImplementation(
      async () =>
        new Response(new ReadableStream({ cancel }), {
          status: 302,
          headers: { location: "/again" },
        })
    );
  expect((await GET(signedRequest(), context)).status).toBe(502);
  expect(fetchPinnedAsset).toHaveBeenCalledTimes(4);
  expect(cancel).toHaveBeenCalledTimes(4);
});
it("caps unknown expiry caching, bounds known expiry, and never caches errors", async () => {
  vi.mocked(lookup).mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
  ] as never);
  vi.mocked(getAssetSource).mockResolvedValue(source);
  vi.mocked(fetchPinnedAsset).mockImplementation(
    async () => new Response("ok")
  );
  expect(
    (await GET(signedRequest(), context)).headers.get("cache-control")
  ).toBe("private, max-age=60");
  vi.mocked(getAssetSource).mockResolvedValue({
    ...source,
    expiresAt: new Date(Date.now() + 15_000),
  });
  const bounded = await GET(signedRequest(), context);
  expect(
    Number(bounded.headers.get("cache-control")!.split("=")[1])
  ).toBeLessThanOrEqual(15);
  vi.mocked(fetchPinnedAsset).mockImplementation(
    async () => new Response("temporary", { status: 503 })
  );
  expect(
    (await GET(signedRequest(), context)).headers.get("cache-control")
  ).toContain("no-store");
});
it("forwards HEAD and an abortable signal without a response body", async () => {
  vi.mocked(getAssetSource).mockResolvedValue(source);
  vi.mocked(lookup).mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
  ] as never);
  vi.mocked(fetchPinnedAsset).mockImplementation(
    async () => new Response(null)
  );
  const req = signedRequest("HEAD");
  expect((await HEAD(req, context)).body).toBeNull();
  expect(fetchPinnedAsset).toHaveBeenLastCalledWith(
    new URL(source.url),
    [{ address: "8.8.8.8", family: 4 }],
    expect.objectContaining({ method: "HEAD", signal: expect.any(AbortSignal) })
  );
});

it("passes provider media types through without sandboxing the document player", async () => {
  vi.mocked(getAssetSource).mockResolvedValue({
    ...source,
    mediaType: "video",
    url: "https://media.example.test/video.mp4",
  });
  vi.mocked(lookup).mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
  ] as never);
  vi.mocked(fetchPinnedAsset).mockImplementation(
    async () =>
      new Response("bytes", { headers: { "content-type": "video/mp4" } })
  );
  const playable = await GET(signedRequest(), context);
  expect(playable.headers.get("content-type")).toBe("video/mp4");
  expect(playable.headers.get("content-security-policy")).toBeNull();
  expect(playable.headers.get("x-content-type-options")).toBe("nosniff");
});

it("does not forward a provider HTML type as playable media", async () => {
  vi.mocked(getAssetSource).mockResolvedValue(source);
  vi.mocked(lookup).mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
  ] as never);
  vi.mocked(fetchPinnedAsset).mockImplementation(
    async () =>
      new Response("<html>", { headers: { "content-type": "text/html" } })
  );
  const blocked = await GET(signedRequest(), context);
  expect(blocked.headers.get("content-type")).not.toBe("text/html");
  expect(blocked.headers.get("content-security-policy")).toContain("sandbox");
});

it("serves only owner-bound synthetic fixtures without widening the proxy host allowlist", async () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("CONSOLE_PREVIEW_FIXTURES", "1");
  try {
    const suffix = createHash("sha256")
      .update("eu_test")
      .digest("hex")
      .slice(0, 12);
    const id = `asset_preview_v2_${suffix}_portrait`;
    vi.mocked(getAssetSource).mockResolvedValue({
      ...source,
      url: "https://old-preview.example/images/console/explore/flux-schnell.webp",
    });
    vi.mocked(lookup).mockClear();
    vi.mocked(fetchPinnedAsset).mockClear();
    const response = await GET(new Request(publicAssetUrl(id, "eu_test")), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "/images/console/explore/flux-schnell.webp"
    );
    expect(lookup).not.toHaveBeenCalled();
    expect(fetchPinnedAsset).not.toHaveBeenCalled();
    vi.mocked(getAssetSource).mockResolvedValue({
      ...source,
      unavailableAt: new Date(),
    });
    expect(
      (
        await GET(new Request(publicAssetUrl(id, "eu_test")), {
          params: Promise.resolve({ id }),
        })
      ).status
    ).toBe(404);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.mocked(getAssetSource).mockResolvedValue({
      ...source,
      url: "https://old-preview.example/file",
    });
    expect(
      (
        await GET(new Request(publicAssetUrl(id, "eu_test")), {
          params: Promise.resolve({ id }),
        })
      ).status
    ).toBe(502);
  } finally {
    vi.unstubAllEnvs();
  }
});
