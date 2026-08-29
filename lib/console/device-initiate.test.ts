import assert from "node:assert/strict";
import { test } from "node:test";

import { PmtHouseError } from "@pymthouse/builder-sdk";
import {
  isDeviceReturnTo,
  parseDeviceInitiateParams,
} from "./device-initiate";

test("isDeviceReturnTo allows /device and query", () => {
  assert.equal(isDeviceReturnTo("/device"), true);
  assert.equal(isDeviceReturnTo("/device?iss=x"), true);
  assert.equal(isDeviceReturnTo("/home"), false);
  assert.equal(isDeviceReturnTo("/device-evil"), false);
});

test("parseDeviceInitiateParams rejects mismatched client id", () => {
  const parsed = {
    issuer: "https://pymthouse.com/api/v1/oidc",
    targetLinkUri: "https://pymthouse.com/api/v1/oidc/device",
    userCode: "ABCD-EFGH",
    clientId: "app_other",
  };
  assert.throws(
    () =>
      parseDeviceInitiateParams(
        new URLSearchParams(),
        { parseDeviceApprovalRedirect: () => parsed },
        "app_expected"
      ),
    (err: unknown) => err instanceof PmtHouseError && err.code === "invalid_client"
  );
});
