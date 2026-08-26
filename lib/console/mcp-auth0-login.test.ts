import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AUTH0_MCP_AUDIENCE_DEFAULT,
  AUTH0_MCP_SCOPES_DEFAULT,
  MCP_AUTH0_RETURN_TO,
  isMcpAuth0ReturnTo,
  mcpAuth0AuthorizationParameters,
  mcpAuth0LoginHref,
} from "./mcp-auth0-login.ts";
import { MCP_OAUTH_COMPLETE_PATH } from "./mcp-oauth-login-bridge.ts";

test("mcpAuth0AuthorizationParameters is empty without AUTH0_MCP_AUDIENCE", () => {
  assert.deepEqual(mcpAuth0AuthorizationParameters({}), {});
  assert.deepEqual(mcpAuth0AuthorizationParameters({ AUTH0_MCP_AUDIENCE: "  " }), {});
});

test("mcpAuth0AuthorizationParameters requests the Auth0 API audience and consent", () => {
  assert.deepEqual(
    mcpAuth0AuthorizationParameters({
      AUTH0_MCP_AUDIENCE: AUTH0_MCP_AUDIENCE_DEFAULT,
    }),
    {
      audience: AUTH0_MCP_AUDIENCE_DEFAULT,
      scope: AUTH0_MCP_SCOPES_DEFAULT,
      prompt: "consent",
    }
  );
  assert.deepEqual(
    mcpAuth0AuthorizationParameters({
      AUTH0_MCP_AUDIENCE: AUTH0_MCP_AUDIENCE_DEFAULT,
      AUTH0_MCP_SCOPES: "openid sign:job",
    }).scope,
    "openid sign:job"
  );
});

test("mcpAuth0LoginHref stays on the MCP Auth0 start route", () => {
  assert.equal(mcpAuth0LoginHref(), "/api/v1/auth/mcp/login");
  assert.equal(
    mcpAuth0LoginHref({ connection: "google-oauth2" }),
    "/api/v1/auth/mcp/login?connection=google-oauth2"
  );
  assert.equal(MCP_AUTH0_RETURN_TO, MCP_OAUTH_COMPLETE_PATH);
  assert.equal(isMcpAuth0ReturnTo(MCP_OAUTH_COMPLETE_PATH), true);
  assert.equal(isMcpAuth0ReturnTo("/home"), false);
});
