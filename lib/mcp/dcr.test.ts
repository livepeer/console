import assert from "node:assert/strict";
import { test } from "node:test";

import { isAllowedClientRedirectUri, normalizeRedirectUris } from "./dcr";

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

test("evil redirects are refused", () => {
  assert.equal(isAllowedClientRedirectUri("https://evil.example/callback"), false);
  assert.equal(
    isAllowedClientRedirectUri("https://claude.ai.evil.example/api/mcp/auth_callback"),
    false
  );
  assert.equal(isAllowedClientRedirectUri("http://192.168.1.4/callback"), false);
  assert.equal(normalizeRedirectUris(["https://evil.example/cb"]), null);
});
