import { describe, expect, it } from "vitest";

import {
  chunkIds,
  forgetAssets,
  likeSubstring,
  listAssets,
  listAssetsForGatewayRequestIds,
  mapAssetRow,
  publicAssetStoreError,
  rememberAsset,
  serializeAsset,
} from "./store";

function neonConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

describe("mcp asset store helpers", () => {
  it("mapAssetRow exposes job ids for ticket joins", () => {
    const asset = mapAssetRow({
      id: "asset_1",
      url: "https://v3b.fal.media/files/x.jpg",
      capability: "livepeer-example/fal-flux-schnell",
      gatewayRequestId: "job_abc",
      providerRequestId: "req-fal",
      createdAt: "2026-09-05T01:00:00.000Z",
    });
    expect(asset.gatewayRequestId).toBe("job_abc");
    expect(serializeAsset(asset)).toEqual({
      id: "asset_1",
      url: "https://v3b.fal.media/files/x.jpg",
      capability: "livepeer-example/fal-flux-schnell",
      created_at: "2026-09-05T01:00:00.000Z",
      gateway_request_id: "job_abc",
      provider_request_id: "req-fal",
    });
  });

  it("likeSubstring escapes ILIKE metacharacters", () => {
    expect(likeSubstring("50%_off\\x")).toBe("50\\%\\_off\\\\x");
  });

  it("chunkIds keeps leftovers instead of truncating", () => {
    const ids = Array.from({ length: 130 }, (_, i) => `job_${i}`);
    const chunks = chunkIds(ids, 100);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(30);
    expect(chunks.flat()).toHaveLength(130);
  });

  it("publicAssetStoreError does not include connection details", () => {
    const payload = publicAssetStoreError();
    expect(JSON.stringify(payload)).not.toContain("postgresql://");
    expect(JSON.stringify(payload)).not.toContain("password");
  });
});

describe.skipIf(!neonConfigured())("mcp asset store against DATABASE_URL", () => {
  it("remember / list / forget persist and do not steal another principal", async () => {
    const stamp = Date.now();
    const jobId = `job_conflict_${stamp}`;
    const url = `https://example.test/conflict/${jobId}.jpg`;
    const owner = `eu_owner_${stamp}`;
    const other = `eu_other_${stamp}`;
    const ownerAsset = await rememberAsset(owner, {
      id: `asset_owner_${stamp}`,
      url,
      capability: "livepeer-example/fal-flux-schnell",
      createdAt: new Date().toISOString(),
      gatewayRequestId: jobId,
      providerRequestId: "req-owner",
    });
    const otherAsset = await rememberAsset(other, {
      id: `asset_other_${stamp}`,
      url,
      capability: "livepeer-example/fal-flux-schnell",
      createdAt: new Date().toISOString(),
      gatewayRequestId: jobId,
      providerRequestId: "req-other",
    });
    expect(ownerAsset.id).not.toBe(otherAsset.id);

    const ownerListed = await listAssets(owner, jobId);
    const otherListed = await listAssets(other, jobId);
    expect(ownerListed).toHaveLength(1);
    expect(ownerListed[0]?.id).toBe(ownerAsset.id);
    expect(otherListed).toHaveLength(1);
    expect(otherListed[0]?.id).toBe(otherAsset.id);

    expect(await forgetAssets(owner, [otherAsset.id])).toBe(0);
    expect(await listAssets(other, jobId)).toHaveLength(1);

    const byIds = await listAssetsForGatewayRequestIds(owner, [jobId, "missing"]);
    expect(byIds.map((asset) => asset.id)).toEqual([ownerAsset.id]);

    expect(await forgetAssets(owner, [ownerAsset.id])).toBe(1);
    expect(await listAssets(owner, jobId)).toEqual([]);
    expect(await listAssets(other, jobId)).toHaveLength(1);
    await forgetAssets(other);
  });
});
