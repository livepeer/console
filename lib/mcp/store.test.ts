import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ASSET_STORE_UNAVAILABLE,
  FORGET_IDS_OR_ALL_REQUIRED,
  chunkIds,
  forgetAssets,
  likeSubstring,
  listAssets,
  listAssetsForGatewayRequestIds,
  mapAssetRow,
  publicAssetStoreError,
  rememberAsset,
  resetAssetStoreForTests,
  serializeAsset,
} from "./store";

function neonConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL?.trim() ||
      process.env.MCP_ASSETS_DATABASE_URL?.trim()
  );
}

test("mapAssetRow exposes job ids for ticket joins", () => {
  const asset = mapAssetRow({
    id: "asset_1",
    url: "https://v3b.fal.media/files/x.jpg",
    capability: "livepeer-example/fal-flux-schnell",
    gatewayRequestId: "job_abc",
    providerRequestId: "req-fal",
    createdAt: "2026-09-05T01:00:00.000Z",
  });
  assert.equal(asset.gatewayRequestId, "job_abc");
  assert.equal(asset.providerRequestId, "req-fal");
  assert.deepEqual(serializeAsset(asset), {
    id: "asset_1",
    url: "https://v3b.fal.media/files/x.jpg",
    capability: "livepeer-example/fal-flux-schnell",
    created_at: "2026-09-05T01:00:00.000Z",
    gateway_request_id: "job_abc",
    provider_request_id: "req-fal",
  });
});

test("likeSubstring escapes ILIKE metacharacters", () => {
  assert.equal(likeSubstring("50%_off\\x"), "50\\%\\_off\\\\x");
});

test("chunkIds keeps leftovers instead of truncating to 50", () => {
  const ids = Array.from({ length: 130 }, (_, i) => `job_${i}`);
  const chunks = chunkIds(ids, 100);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0]?.length, 100);
  assert.equal(chunks[1]?.length, 30);
  assert.equal(chunks.flat().length, 130);
});

test("publicAssetStoreError does not include connection details", () => {
  const payload = publicAssetStoreError();
  assert.equal(payload.error, ASSET_STORE_UNAVAILABLE);
  assert.equal(payload.message.includes("postgresql://"), false);
  assert.equal(JSON.stringify(payload).includes("password"), false);
});

test("forgetAssets without ids or all throws a stable code", async (t) => {
  if (!neonConfigured()) {
    t.skip("DATABASE_URL not set");
    return;
  }
  await assert.rejects(
    () => forgetAssets(`eu_test_${Date.now()}`),
    (err: unknown) =>
      err instanceof Error && err.name === FORGET_IDS_OR_ALL_REQUIRED
  );
});

test("remember / list / forget persist against Neon when DATABASE_URL is set", async (t) => {
  if (!neonConfigured()) {
    t.skip("DATABASE_URL not set");
    return;
  }
  const principalId = `eu_test_${Date.now()}`;
  const jobId = `job_test_${Date.now()}`;
  const remembered = await rememberAsset(principalId, {
    id: `asset_test_${Date.now()}`,
    url: `https://example.test/${jobId}.jpg`,
    capability: "livepeer-example/fal-flux-schnell",
    createdAt: new Date().toISOString(),
    gatewayRequestId: jobId,
    providerRequestId: "req-test",
  });
  assert.equal(remembered.gatewayRequestId, jobId);

  const listed = await listAssets(principalId, { gatewayRequestId: jobId });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.url, remembered.url);

  const forgotten = await forgetAssets(principalId, { ids: [remembered.id] });
  assert.equal(forgotten, 1);
  assert.deepEqual(await listAssets(principalId, { gatewayRequestId: jobId }), []);
});

test("listAssetsForGatewayRequestIds returns newest URL per job", async (t) => {
  if (!neonConfigured()) {
    t.skip("DATABASE_URL not set");
    return;
  }
  const stamp = Date.now();
  const principalId = `eu_join_${stamp}`;
  const jobA = `job_a_${stamp}`;
  const jobB = `job_b_${stamp}`;
  await rememberAsset(principalId, {
    id: `asset_a1_${stamp}`,
    url: `https://example.test/a1/${jobA}.jpg`,
    capability: "livepeer-example/fal-flux-schnell",
    createdAt: new Date().toISOString(),
    gatewayRequestId: jobA,
  });
  await rememberAsset(principalId, {
    id: `asset_b_${stamp}`,
    url: `https://example.test/b/${jobB}.jpg`,
    capability: "livepeer-example/fal-flux-schnell",
    createdAt: new Date().toISOString(),
    gatewayRequestId: jobB,
  });
  const listed = await listAssetsForGatewayRequestIds(principalId, [
    jobA,
    jobB,
    "job_missing",
  ]);
  const urls = new Map(listed.map((asset) => [asset.gatewayRequestId, asset.url]));
  assert.equal(urls.get(jobA)?.includes(jobA), true);
  assert.equal(urls.get(jobB)?.includes(jobB), true);
  await forgetAssets(principalId, { all: true });
});

test("conflict on the same job URL does not steal another principal", async (t) => {
  if (!neonConfigured()) {
    t.skip("DATABASE_URL not set");
    return;
  }
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
  assert.notEqual(ownerAsset.id, otherAsset.id);

  const ownerListed = await listAssets(owner, { gatewayRequestId: jobId });
  const otherListed = await listAssets(other, { gatewayRequestId: jobId });
  assert.equal(ownerListed.length, 1);
  assert.equal(ownerListed[0]?.id, ownerAsset.id);
  assert.equal(otherListed.length, 1);
  assert.equal(otherListed[0]?.id, otherAsset.id);

  assert.equal(await forgetAssets(owner, { ids: [otherAsset.id] }), 0);
  assert.equal((await listAssets(other, { gatewayRequestId: jobId })).length, 1);

  assert.equal(await forgetAssets(owner, { all: true }), 1);
  assert.equal((await listAssets(owner, { gatewayRequestId: jobId })).length, 0);
  assert.equal((await listAssets(other, { gatewayRequestId: jobId })).length, 1);
  await forgetAssets(other, { all: true });
});

test("ILIKE search treats percent and underscore as literals", async (t) => {
  if (!neonConfigured()) {
    t.skip("DATABASE_URL not set");
    return;
  }
  const stamp = Date.now();
  const principalId = `eulike${stamp}`;
  const jobId = `joblike${stamp}`;
  await rememberAsset(principalId, {
    id: `assetlike${stamp}`,
    url: `https://example.test/plain/${jobId}.jpg`,
    capability: "livepeer-example/fal-flux-schnell",
    createdAt: new Date().toISOString(),
    gatewayRequestId: jobId,
  });
  assert.equal((await listAssets(principalId, { query: "%" })).length, 0);
  assert.equal((await listAssets(principalId, { query: "_" })).length, 0);
  await forgetAssets(principalId, { all: true });
});

test("remember fails closed when the database URL is unreachable", async (t) => {
  if (!neonConfigured()) {
    t.skip("DATABASE_URL not set");
    return;
  }
  const original = process.env.DATABASE_URL;
  const originalMcp = process.env.MCP_ASSETS_DATABASE_URL;
  process.env.MCP_ASSETS_DATABASE_URL = "";
  process.env.DATABASE_URL =
    "postgresql://neondb_owner:wrong@no-such-host.invalid/neondb?sslmode=require";
  resetAssetStoreForTests();
  await assert.rejects(() =>
    rememberAsset("eu_retry", {
      id: "asset_retry",
      url: "https://example.test/retry.jpg",
      capability: "x",
      createdAt: new Date().toISOString(),
      gatewayRequestId: "job_retry",
    })
  );
  if (original) process.env.DATABASE_URL = original;
  else delete process.env.DATABASE_URL;
  if (originalMcp) process.env.MCP_ASSETS_DATABASE_URL = originalMcp;
  else delete process.env.MCP_ASSETS_DATABASE_URL;
  resetAssetStoreForTests();
  const principalId = `eu_retry_${Date.now()}`;
  const remembered = await rememberAsset(principalId, {
    id: `asset_retry_${Date.now()}`,
    url: `https://example.test/retry/${Date.now()}.jpg`,
    capability: "livepeer-example/fal-flux-schnell",
    createdAt: new Date().toISOString(),
    gatewayRequestId: `job_retry_${Date.now()}`,
  });
  assert.ok(remembered.id);
  await forgetAssets(principalId, { all: true });
});
