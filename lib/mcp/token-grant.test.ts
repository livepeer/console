import assert from "node:assert/strict";
import { test } from "node:test";

import { issueAuthCode, issueClientId, sha256Base64Url } from "./as";
import { validateAuthorizationCodeGrant } from "./token-grant";

process.env.MCP_AS_SECRET = "test-as-secret";

const VERIFIER = "a".repeat(64);

const CLAUDE_CLIENT_ID = issueClientId([
  "https://claude.ai/api/mcp/auth_callback",
]);
const CODEX_CLIENT_ID = "https://chatgpt.com/oauth/codex/client.json";
const HERMES_CLIENT_ID =
  "https://nousresearch.github.io/hermes-agent/docs/oauth/client-metadata.json";

function code(overrides: {
  redirectUri: string;
  clientId: string;
  codeChallenge?: string;
  externalUserId?: string;
  email?: string;
  identityCode?: string;
}) {
  return issueAuthCode({
    codeChallenge: sha256Base64Url(VERIFIER),
    externalUserId: "eu_1",
    ...overrides,
  });
}

function redeem(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier?: string;
}) {
  return validateAuthorizationCodeGrant({
    codeVerifier: VERIFIER,
    ...input,
  });
}

test("all three clients redeem their own authorize redirect", () => {
  const clients = [
    {
      clientId: CLAUDE_CLIENT_ID,
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
    },
    // Codex registers http://127.0.0.1/callback and authorizes on an
    // ephemeral port; the code carries the port it actually authorized with.
    {
      clientId: CODEX_CLIENT_ID,
      redirectUri: "http://127.0.0.1:48004/callback",
    },
    {
      clientId: HERMES_CLIENT_ID,
      redirectUri: "http://127.0.0.1:27890/callback",
    },
  ];
  for (const client of clients) {
    const result = redeem({ ...client, code: code(client) });
    assert.equal(result.ok, true, `${client.clientId} should redeem`);
    assert.equal(result.ok && result.grant.externalUserId, "eu_1");
  }
});

test("client_id is optional but must match the authorize request", () => {
  const client = {
    clientId: CODEX_CLIENT_ID,
    redirectUri: "http://127.0.0.1:48004/callback",
  };
  const issued = code(client);
  assert.equal(redeem({ ...client, clientId: "", code: issued }).ok, true);

  const swapped = redeem({
    ...client,
    clientId: HERMES_CLIENT_ID,
    code: issued,
  });
  assert.equal(swapped.ok, false);
  assert.equal(!swapped.ok && swapped.error, "invalid_client");
});

test("redirect_uri must be byte-identical to the authorize request", () => {
  const issued = code({
    clientId: CODEX_CLIENT_ID,
    redirectUri: "http://127.0.0.1:48004/callback",
  });
  for (const redirectUri of [
    "http://127.0.0.1:48004/callback/",
    "http://127.0.0.1/callback",
    "http://127.0.0.1:59999/callback",
    "http://localhost:48004/callback",
  ]) {
    const result = redeem({
      code: issued,
      redirectUri,
      clientId: CODEX_CLIENT_ID,
    });
    assert.equal(result.ok, false, `${redirectUri} must not redeem`);
    assert.equal(!result.ok && result.error, "invalid_grant");
  }
});

test("missing parameters are invalid_request, bad credentials are invalid_grant", () => {
  const client = {
    clientId: CLAUDE_CLIENT_ID,
    redirectUri: "https://claude.ai/api/mcp/auth_callback",
  };

  const missing = redeem({ ...client, code: "" });
  assert.equal(!missing.ok && missing.error, "invalid_request");

  const noVerifier = redeem({
    ...client,
    code: code(client),
    codeVerifier: "",
  });
  assert.equal(!noVerifier.ok && noVerifier.error, "invalid_request");

  const forged = redeem({ ...client, code: `${code(client)}x` });
  assert.equal(!forged.ok && forged.error, "invalid_grant");

  const wrongVerifier = redeem({
    ...client,
    code: code(client),
    codeVerifier: "b".repeat(64),
  });
  assert.equal(!wrongVerifier.ok && wrongVerifier.error, "invalid_grant");
});

test("an identity-only code cannot mint tokens", () => {
  const client = {
    clientId: CLAUDE_CLIENT_ID,
    redirectUri: "https://claude.ai/api/mcp/auth_callback",
  };
  const result = redeem({
    ...client,
    code: issueAuthCode({
      ...client,
      codeChallenge: sha256Base64Url(VERIFIER),
      identityCode: "mcp_id_abc",
    }),
  });
  assert.equal(!result.ok && result.error, "invalid_grant");
});
