import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clientAllowsRedirect,
  isAllowedClientRedirectUri,
  normalizeRedirectUris,
  redirectUrisMatch,
} from "./dcr";

test("Claude MCP callbacks are allowed", () => {
  assert.equal(
    isAllowedClientRedirectUri("https://claude.ai/api/mcp/auth_callback"),
    true
  );
  assert.equal(
    isAllowedClientRedirectUri("https://claude.com/api/mcp/auth_callback"),
    true
  );
});

test("RFC 8252 loopback any path is allowed", () => {
  assert.equal(
    isAllowedClientRedirectUri("http://127.0.0.1:8787/callback"),
    true
  );
  assert.equal(
    isAllowedClientRedirectUri("http://localhost:3000/oauth/callback"),
    true
  );
  assert.equal(isAllowedClientRedirectUri("http://[::1]/callback"), true);
  assert.equal(isAllowedClientRedirectUri("http://127.0.0.1:1455/"), true);
  assert.equal(
    isAllowedClientRedirectUri("http://127.0.0.1:8765/oauth/native"),
    true
  );
});

test("Cursor MCP callbacks are allowed", () => {
  assert.equal(
    isAllowedClientRedirectUri("cursor://anysphere.cursor-mcp/oauth/callback"),
    true
  );
  assert.equal(
    isAllowedClientRedirectUri(
      "https://www.cursor.com/agents/mcp/oauth/callback"
    ),
    true
  );
  assert.equal(
    isAllowedClientRedirectUri("https://cursor.com/agents/mcp/oauth/callback"),
    true
  );
  assert.equal(
    isAllowedClientRedirectUri("cursor://evil/oauth/callback"),
    false
  );
  assert.equal(
    isAllowedClientRedirectUri("https://www.cursor.com/oauth/callback"),
    false
  );
});

test("ChatGPT connector callbacks are allowed", () => {
  assert.equal(
    isAllowedClientRedirectUri(
      "https://chatgpt.com/connector/oauth/BKj9umzr4ef_"
    ),
    true
  );
  assert.equal(
    isAllowedClientRedirectUri(
      "https://chatgpt.com/connector_platform_oauth_redirect"
    ),
    true
  );
  assert.equal(
    isAllowedClientRedirectUri("https://chatgpt.com/connector/oauth/"),
    false
  );
  assert.equal(
    isAllowedClientRedirectUri("https://www.chatgpt.com/connector/oauth/abc"),
    false
  );
  assert.equal(
    isAllowedClientRedirectUri(
      "https://chatgpt.com.evil.example/connector/oauth/abc"
    ),
    false
  );
});

test("loopback registered URI matches Codex port and host swaps", () => {
  assert.equal(
    redirectUrisMatch(
      "http://127.0.0.1/callback/BKj9umzr4ef_",
      "http://127.0.0.1:39053/callback/BKj9umzr4ef_"
    ),
    true
  );
  assert.equal(
    redirectUrisMatch(
      "http://127.0.0.1:39053/callback/BKj9umzr4ef_",
      "http://localhost:39053/callback/BKj9umzr4ef_"
    ),
    true
  );
  assert.equal(
    clientAllowsRedirect(
      ["http://127.0.0.1/callback/abc"],
      "http://localhost:5555/callback/abc"
    ),
    true
  );
  assert.equal(
    redirectUrisMatch(
      "http://127.0.0.1/callback/abc",
      "http://127.0.0.1/callback/other"
    ),
    false
  );
  assert.equal(
    redirectUrisMatch(
      "https://chatgpt.com/connector/oauth/abc",
      "https://chatgpt.com/connector/oauth/def"
    ),
    false
  );
  assert.equal(
    redirectUrisMatch(
      "http://127.0.0.1/callback",
      "http://127.0.0.1:48004/callback"
    ),
    true
  );
  assert.equal(
    redirectUrisMatch(
      "http://127.0.0.1:27890/callback",
      "http://127.0.0.1:27890/callback/"
    ),
    true
  );
});

test("normalizeRedirectUris accepts Hermes CIMD loopback lists", () => {
  const uris = [
    "http://127.0.0.1:27890/callback",
    "http://localhost:27890/callback",
    "http://127.0.0.1:27891/callback",
    "http://localhost:27891/callback",
    "http://127.0.0.1:27892/callback",
    "http://localhost:27892/callback",
    "http://127.0.0.1:27893/callback",
    "http://localhost:27893/callback",
    "http://127.0.0.1:27894/callback",
    "http://localhost:27894/callback",
  ];
  assert.deepEqual(normalizeRedirectUris(uris), uris);
  assert.equal(
    normalizeRedirectUris(
      Array.from({ length: 17 }, () => "http://127.0.0.1/cb")
    ),
    null
  );
});

test("evil redirects are refused", () => {
  assert.equal(
    isAllowedClientRedirectUri("https://evil.example/callback"),
    false
  );
  assert.equal(
    isAllowedClientRedirectUri(
      "https://claude.ai.evil.example/api/mcp/auth_callback"
    ),
    false
  );
  assert.equal(
    isAllowedClientRedirectUri("http://192.168.1.4/callback"),
    false
  );
  assert.equal(normalizeRedirectUris(["https://evil.example/cb"]), null);
});
