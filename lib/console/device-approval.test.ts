import assert from "node:assert/strict";
import { test } from "node:test";

import { PmtHouseError } from "@pymthouse/builder-sdk";

import {
  isDeviceReturnTo,
  parseDeviceInitiateParams,
} from "./device-initiate.ts";

const ISSUER = "https://pymthouse.com/api/v1/oidc";
const CLIENT = "app_98575870d7ae33589a3f0660";
const TARGET = `${new URL(ISSUER).origin}/oidc/device?user_code=ABCD-EFGH&client_id=${CLIENT}`;

function params(overrides?: Record<string, string>): URLSearchParams {
  return new URLSearchParams({
    iss: ISSUER,
    target_link_uri: TARGET,
    ...overrides,
  });
}

test("isDeviceReturnTo allows only /device paths", () => {
  assert.equal(isDeviceReturnTo("/device"), true);
  assert.equal(isDeviceReturnTo("/device?iss=x"), true);
  assert.equal(isDeviceReturnTo("/home"), false);
  assert.equal(isDeviceReturnTo("/device/evil"), false);
  assert.equal(isDeviceReturnTo("https://evil.example/device"), false);
});

test("parseDeviceInitiateParams rejects a client_id that is not the configured app", () => {
  assert.throws(
    () =>
      parseDeviceInitiateParams(params(), {
        parseDeviceApprovalRedirect: () => ({
          issuer: ISSUER,
          targetLinkUri: TARGET,
          userCode: "ABCDEFGH",
          clientId: "app_other",
        }),
      }, CLIENT),
    (err: unknown) =>
      err instanceof PmtHouseError && err.code === "invalid_client"
  );
});

test("parseDeviceInitiateParams returns the SDK parse when client_id matches", () => {
  const parsed = parseDeviceInitiateParams(
    params(),
    {
      parseDeviceApprovalRedirect: () => ({
        issuer: ISSUER,
        targetLinkUri: TARGET,
        userCode: "ABCDEFGH",
        clientId: CLIENT,
      }),
    },
    CLIENT
  );
  assert.equal(parsed.userCode, "ABCDEFGH");
  assert.equal(parsed.clientId, CLIENT);
});
