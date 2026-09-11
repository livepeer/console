import assert from "node:assert/strict";
import { test } from "node:test";

import {
  issueMcpRefreshToken,
  redeemMcpRefreshToken,
} from "./mcp-oauth-login-bridge";

test("refresh token round-trips eu", () => {
  process.env.MCP_OAUTH_BRIDGE_SECRET = "test-bridge-secret";
  const token = issueMcpRefreshToken("eu_abc");
  assert.equal(redeemMcpRefreshToken(token), "eu_abc");
  assert.equal(redeemMcpRefreshToken(`${token}x`), null);
});
