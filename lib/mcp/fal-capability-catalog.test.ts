import assert from "node:assert/strict";
import { test } from "node:test";

import { FAL_CAPABILITY_CATALOG, lookupFalCapability } from "./fal-capability-catalog";

test("fal catalog has 73 entries", () => {
  assert.equal(FAL_CAPABILITY_CATALOG.length, 73);
});

test("lookupFalCapability resolves exact app ids", () => {
  const row = lookupFalCapability("livepeer-example/fal-flux-schnell");
  assert.ok(row);
  assert.equal(row.endpointId, "fal-ai/flux/schnell");
  assert.equal(row.provider, "fal");
});

test("lookupFalCapability is case-insensitive", () => {
  assert.ok(lookupFalCapability("LIVEPEER-EXAMPLE/FAL-FLUX-SCHNELL"));
});
