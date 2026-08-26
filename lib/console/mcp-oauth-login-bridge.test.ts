import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMcpOauthCallbackUrl,
  decodeMcpOauthPendingCookie,
  encodeMcpOauthPendingCookie,
  issueMcpIdentityCode,
  isAllowedMcpRedirectUri,
  parseMcpOauthLoginQuery,
  redeemMcpIdentityCode,
  resolveMcpMintSubject,
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

test("buildMcpOauthCallbackUrl echoes state, hashed subject, and code", () => {
  const url = buildMcpOauthCallbackUrl({
    redirectUri: CALLBACK,
    state: "st-1",
    externalUserId: "eu_abc",
    email: "user@example.com",
    code: "mcp_id_test",
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("state"), "st-1");
  assert.equal(parsed.searchParams.get("external_user_id"), "eu_abc");
  assert.equal(parsed.searchParams.get("code"), "mcp_id_test");
  assert.equal(parsed.searchParams.get("email"), "user@example.com");
});

test("identity code binds mint to login; free-form id is not a subject", () => {
  process.env.MCP_OAUTH_BRIDGE_SECRET = "test-bridge-secret";
  const code = issueMcpIdentityCode({
    externalUserId: "eu_from_login",
    email: "user@example.com",
    state: "st-1",
  });
  assert.deepEqual(redeemMcpIdentityCode(code), {
    externalUserId: "eu_from_login",
    email: "user@example.com",
    state: "st-1",
  });
  assert.equal(redeemMcpIdentityCode(`${code}x`), null);
  assert.deepEqual(resolveMcpMintSubject({}), {
    ok: false,
    status: 400,
    error: "invalid_request",
    error_description: "code is required",
  });
  assert.deepEqual(resolveMcpMintSubject({ externalUserId: "eu_from_login" }), {
    ok: false,
    status: 400,
    error: "invalid_request",
    error_description: "code is required",
  });
  assert.deepEqual(resolveMcpMintSubject({ code: "mcp_id_bogus" }), {
    ok: false,
    status: 401,
    error: "unauthorized",
    error_description: "invalid or expired code",
  });
  assert.deepEqual(
    resolveMcpMintSubject({ code, externalUserId: "eu_someone_else" }),
    {
      ok: false,
      status: 400,
      error: "invalid_request",
      error_description: "externalUserId does not match code",
    }
  );
  assert.deepEqual(resolveMcpMintSubject({ code }), {
    ok: true,
    externalUserId: "eu_from_login",
    email: "user@example.com",
  });
});
