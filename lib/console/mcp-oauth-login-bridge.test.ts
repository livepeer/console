import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMcpOauthCallbackUrl,
  decodeMcpOauthPendingCookie,
  encodeMcpOauthPendingCookie,
  isAllowedMcpRedirectUri,
  parseMcpOauthLoginQuery,
} from "./mcp-oauth-login-bridge.ts";

const CALLBACK = "https://agent.livepeer.org/api/mcp/oauth/callback";

test("parseMcpOauthLoginQuery rejects evil redirect and missing state", () => {
  process.env.MCP_OAUTH_REDIRECT_ALLOWLIST = CALLBACK;
  assert.equal(
    parseMcpOauthLoginQuery({
      mcpOauth: "1",
      state: "abc",
      redirectUri: "https://evil.example/cb",
    }).ok,
    false
  );
  assert.equal(
    parseMcpOauthLoginQuery({
      mcpOauth: "1",
      state: "",
      redirectUri: CALLBACK,
    }).ok,
    false
  );
  assert.deepEqual(
    parseMcpOauthLoginQuery({
      mcpOauth: "1",
      state: "abc",
      redirectUri: CALLBACK,
    }),
    { ok: true, pending: { state: "abc", redirectUri: CALLBACK } }
  );
});

test("isAllowedMcpRedirectUri derives callback from mint allowlist", () => {
  delete process.env.MCP_OAUTH_REDIRECT_ALLOWLIST;
  process.env.MCP_INTERNAL_MINT_ALLOWLIST = "https://agent.livepeer.org";
  assert.equal(isAllowedMcpRedirectUri(CALLBACK), true);
  assert.equal(isAllowedMcpRedirectUri("https://evil.example/cb"), false);
});

test("pending cookie round-trips and rejects tampering", () => {
  process.env.MCP_OAUTH_BRIDGE_SECRET = "test-bridge-secret";
  process.env.MCP_OAUTH_REDIRECT_ALLOWLIST = CALLBACK;
  const encoded = encodeMcpOauthPendingCookie({
    state: "st-1",
    redirectUri: CALLBACK,
  });
  assert.deepEqual(decodeMcpOauthPendingCookie(encoded), {
    state: "st-1",
    redirectUri: CALLBACK,
  });
  assert.equal(decodeMcpOauthPendingCookie(`${encoded}x`), null);
});

test("buildMcpOauthCallbackUrl echoes state and subject", () => {
  const url = buildMcpOauthCallbackUrl({
    redirectUri: CALLBACK,
    state: "st-1",
    externalUserId: "eu_abc",
    email: "user@example.com",
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("state"), "st-1");
  assert.equal(parsed.searchParams.get("external_user_id"), "eu_abc");
  assert.equal(parsed.searchParams.get("email"), "user@example.com");
});
