import assert from "node:assert/strict";
import { test } from "node:test";

import {
  runCapabilityFailurePayload,
  validateRunCapabilityEndpoint,
} from "./run-capability";

test("validateRunCapabilityEndpoint rejects endpoint on single-shot", () => {
  const err = validateRunCapabilityEndpoint(
    "livepeer-example/fal-flux-schnell",
    { mode: "single-shot" },
    "/hello"
  );
  assert.ok(err);
  assert.equal(err.error, "endpoint_not_supported");
  assert.equal(err.mode, "single-shot");
});

test("validateRunCapabilityEndpoint rejects endpoint when capability is unknown", () => {
  const err = validateRunCapabilityEndpoint("missing/app", null, "/hello");
  assert.ok(err);
  assert.equal(err.error, "endpoint_not_supported");
  assert.equal(err.mode, null);
});

test("validateRunCapabilityEndpoint requires endpoint on persistent", () => {
  const err = validateRunCapabilityEndpoint(
    "livepeer-example/hello-world",
    { mode: "persistent" }
  );
  assert.ok(err);
  assert.equal(err.error, "endpoint_required");
});

test("validateRunCapabilityEndpoint allows persistent with endpoint", () => {
  assert.equal(
    validateRunCapabilityEndpoint(
      "livepeer-example/hello-world",
      { mode: "persistent" },
      "/hello"
    ),
    null
  );
});

test("validateRunCapabilityEndpoint allows single-shot without endpoint", () => {
  assert.equal(
    validateRunCapabilityEndpoint(
      "livepeer-example/fal-flux-schnell",
      { mode: "single-shot" }
    ),
    null
  );
});

test("runCapabilityFailurePayload reports the minted id when the error has none", () => {
  const payload = runCapabilityFailurePayload(
    new Error("runner 500"),
    "job_minted1"
  );
  assert.equal(payload.error, "runner 500");
  assert.equal(payload.gateway_request_id, "job_minted1");
});

test("runCapabilityFailurePayload prefers the id stamped on the thrown error", () => {
  const err = Object.assign(new Error("paid then failed"), {
    gatewayRequestId: "job_from_sdk",
  });
  const payload = runCapabilityFailurePayload(err, "job_minted1");
  assert.equal(payload.gateway_request_id, "job_from_sdk");
  assert.equal(payload.request_id, undefined);
});

test("runCapabilityFailurePayload forwards provider request id from #26 errors", () => {
  const err = Object.assign(new Error("runner 500"), {
    gatewayRequestId: "job_from_sdk",
    providerRequestId: "req-fal-abc",
  });
  const payload = runCapabilityFailurePayload(err, "job_minted1");
  assert.equal(payload.gateway_request_id, "job_from_sdk");
  assert.equal(payload.request_id, "req-fal-abc");
});
