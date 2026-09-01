import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMcpOauthCallbackUrl,
  decodeMcpOauthPendingCookie,
  encodeMcpOauthPendingCookie,
  issueMcpIdentityCode,
  issueMcpRefreshToken,
  isAllowedMcpRedirectUri,
  parseMcpOauthLoginQuery,
  redeemMcpIdentityCode,
  redeemMcpRefreshToken,
  resolveMcpMintSubject
} from "./mcp-oauth-login-bridge";

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
  delete process.env.APP_BASE_URL;
  process.env.MCP_INTERNAL_MINT_ALLOWLIST = "https://agent.livepeer.org";
  assert.equal(isAllowedMcpRedirectUri(CALLBACK), true);
  assert.equal(isAllowedMcpRedirectUri("https://evil.example/cb"), false);
});

test("first-party Console callback is allowed from APP_BASE_URL", () => {
  delete process.env.MCP_OAUTH_REDIRECT_ALLOWLIST;
  delete process.env.MCP_INTERNAL_MINT_ALLOWLIST;
  process.env.APP_BASE_URL = "https://dashboard.livepeer.org";
  assert.equal(
    isAllowedMcpRedirectUri(
      "https://dashboard.livepeer.org/api/mcp/oauth/callback"
    ),
    true
  );
  assert.equal(
    isAllowedMcpRedirectUri(
      "http://localhost:3000/api/mcp/oauth/callback",
      "http://localhost:3000"
    ),
    true
  );
  assert.equal(
    isAllowedMcpRedirectUri("https://evil.example/api/mcp/oauth/callback"),
    false
  );
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

test("identity code round-trips and mint subject requires matching eu", () => {
  process.env.MCP_OAUTH_BRIDGE_SECRET = "test-bridge-secret";
  const code = issueMcpIdentityCode({
    externalUserId: "eu_abc",
    email: "user@example.com",
    state: "st-1",
  });
  assert.deepEqual(redeemMcpIdentityCode(code), {
    externalUserId: "eu_abc",
    email: "user@example.com",
    state: "st-1",
  });
  assert.deepEqual(resolveMcpMintSubject({ code }), {
    ok: true,
    externalUserId: "eu_abc",
    email: "user@example.com",
  });
  assert.equal(
    resolveMcpMintSubject({ code, externalUserId: "eu_other" }).ok,
    false
  );
});

test("an unsigned identity code cannot assert a subject", () => {
  process.env.MCP_OAUTH_BRIDGE_SECRET = "test-bridge-secret";
  // /token resolves the subject through this; a caller who supplies a forged
  // code plus the subject it wants must not mint for that subject.
  assert.equal(
    resolveMcpMintSubject({
      code: "mcp_id_forged",
      externalUserId: "eu_victim",
    }).ok,
    false
  );
  assert.equal(resolveMcpMintSubject({ externalUserId: "eu_victim" }).ok, false);
});

test("refresh token round-trips eu", () => {
  process.env.MCP_OAUTH_BRIDGE_SECRET = "test-bridge-secret";
  const token = issueMcpRefreshToken("eu_abc");
  assert.equal(redeemMcpRefreshToken(token), "eu_abc");
  assert.equal(redeemMcpRefreshToken(`${token}x`), null);
});

test("buildMcpOauthCallbackUrl echoes state, subject, and code", () => {
  const url = buildMcpOauthCallbackUrl({
    redirectUri: CALLBACK,
    state: "st-1",
    externalUserId: "eu_abc",
    email: "user@example.com",
    code: "mcp_id_xyz",
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("state"), "st-1");
  assert.equal(parsed.searchParams.get("external_user_id"), "eu_abc");
  assert.equal(parsed.searchParams.get("email"), "user@example.com");
  assert.equal(parsed.searchParams.get("code"), "mcp_id_xyz");
});
