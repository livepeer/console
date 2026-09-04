import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clearCimdCache,
  isAllowedCimdClientId,
  isKnownClientId,
  resolveCimdClient,
  resolveOAuthClient
} from "./cimd";
import { issueClientId } from "./as";

process.env.MCP_AS_SECRET = "test-as-secret";

const CODEX_CIMD = "https://chatgpt.com/oauth/codex/BKj9umzr4ef_/client.json";
const CODEX_STABLE = "https://chatgpt.com/oauth/codex/client.json";
const CHATGPT_CIMD = "https://chatgpt.com/oauth/BKj9umzr4ef_/client.json";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("Codex and ChatGPT CIMD URLs are allowed", () => {
  assert.equal(isAllowedCimdClientId(CODEX_CIMD), true);
  assert.equal(isAllowedCimdClientId(CODEX_STABLE), true);
  assert.equal(isAllowedCimdClientId(CHATGPT_CIMD), true);
  assert.equal(
    isAllowedCimdClientId("https://chatgpt.com/oauth/evil/nested/client.json"),
    false
  );
  assert.equal(
    isAllowedCimdClientId("https://evil.example/oauth/codex/client.json"),
    false
  );
  assert.equal(
    isAllowedCimdClientId("http://chatgpt.com/oauth/codex/client.json"),
    false
  );
  assert.equal(
    isAllowedCimdClientId("https://chatgpt.com/oauth/codex/client.json?x=1"),
    false
  );
});

test("resolveCimdClient accepts Codex loopback metadata", async () => {
  clearCimdCache();
  const result = await resolveCimdClient(CODEX_CIMD, async () =>
    jsonResponse({
      client_id: CODEX_CIMD,
      redirect_uris: ["http://127.0.0.1/callback/BKj9umzr4ef_"],
      token_endpoint_auth_methods_supported: ["none", "private_key_jwt"]
    })
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.client.redirectUris, [
      "http://127.0.0.1/callback/BKj9umzr4ef_"
    ]);
  }
});

test("resolveCimdClient accepts ChatGPT connector redirects", async () => {
  clearCimdCache();
  const result = await resolveCimdClient(CHATGPT_CIMD, async () =>
    jsonResponse({
      client_id: CHATGPT_CIMD,
      redirect_uris: ["https://chatgpt.com/connector/oauth/BKj9umzr4ef_"],
      token_endpoint_auth_method: "none"
    })
  );
  assert.equal(result.ok, true);
});

test("resolveCimdClient refuses private-only clients and evil redirects", async () => {
  clearCimdCache();
  const jwtOnly = await resolveCimdClient(CODEX_STABLE, async () =>
    jsonResponse({
      client_id: CODEX_STABLE,
      redirect_uris: ["http://127.0.0.1/callback"],
      token_endpoint_auth_methods_supported: ["private_key_jwt"]
    })
  );
  assert.deepEqual(jwtOnly, { ok: false, error: "invalid_client" });

  clearCimdCache();
  const evil = await resolveCimdClient(CODEX_STABLE, async () =>
    jsonResponse({
      client_id: CODEX_STABLE,
      redirect_uris: ["https://evil.example/callback"]
    })
  );
  assert.deepEqual(evil, { ok: false, error: "invalid_client" });
});

test("resolveCimdClient refuses client_id mismatches and fetch failures", async () => {
  clearCimdCache();
  const mismatch = await resolveCimdClient(CODEX_STABLE, async () =>
    jsonResponse({
      client_id: "https://chatgpt.com/oauth/other/client.json",
      redirect_uris: ["http://127.0.0.1/callback"]
    })
  );
  assert.deepEqual(mismatch, { ok: false, error: "invalid_client" });

  clearCimdCache();
  const down = await resolveCimdClient(CODEX_STABLE, async () => {
    throw new Error("network");
  });
  assert.deepEqual(down, { ok: false, error: "temporarily_unavailable" });

  clearCimdCache();
  const serverError = await resolveCimdClient(CODEX_STABLE, async () =>
    jsonResponse({ error: "down" }, 502)
  );
  assert.deepEqual(serverError, {
    ok: false,
    error: "temporarily_unavailable"
  });
});

test("resolveCimdClient caches a successful document", async () => {
  clearCimdCache();
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return jsonResponse({
      client_id: CODEX_STABLE,
      redirect_uris: ["http://127.0.0.1/callback"]
    });
  };
  await resolveCimdClient(CODEX_STABLE, fetchImpl);
  await resolveCimdClient(CODEX_STABLE, fetchImpl);
  assert.equal(calls, 1);
});

test("resolveOAuthClient still accepts DCR client ids", async () => {
  const id = issueClientId(["https://claude.ai/api/mcp/auth_callback"]);
  const resolved = await resolveOAuthClient(id);
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.deepEqual(resolved.client.redirectUris, [
      "https://claude.ai/api/mcp/auth_callback"
    ]);
  }
  assert.equal(isKnownClientId(id), true);
  assert.equal(isKnownClientId(CODEX_CIMD), true);
  assert.equal(isKnownClientId("not-a-client"), false);
});
