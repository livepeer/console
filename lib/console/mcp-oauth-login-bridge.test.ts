import assert from "node:assert/strict";
import { test } from "node:test";

import {
  billingAppMismatch,
  issueMcpRefreshToken,
  redeemMcpRefreshToken,
  RS2_TEST_BILLING_APP_ID
} from "./mcp-oauth-login-bridge";

test("refresh token round-trips eu", () => {
  process.env.MCP_OAUTH_BRIDGE_SECRET = "test-bridge-secret";
  const token = issueMcpRefreshToken("eu_abc");
  assert.equal(redeemMcpRefreshToken(token), "eu_abc");
  assert.equal(redeemMcpRefreshToken(`${token}x`), null);
});

test("billingAppMismatch pins RS-2 in non-prod", () => {
  const prev = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  process.env.PYMTHOUSE_PUBLIC_CLIENT_ID = "app_deadbeefdeadbeefdeadbeef";
  assert.equal(billingAppMismatch()?.error, "billing_app_mismatch");
  process.env.PYMTHOUSE_PUBLIC_CLIENT_ID = RS2_TEST_BILLING_APP_ID;
  assert.equal(billingAppMismatch(), null);
  if (prev === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = prev;
});
