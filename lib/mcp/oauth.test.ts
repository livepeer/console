import assert from "node:assert/strict";
import { test } from "node:test";

import { consoleLoginUrl, isAllowedMcpResource } from "./oauth";

test("RFC 8707 resource is optional and must match /api/mcp when present", () => {
  process.env.MCP_PUBLIC_ORIGIN = "https://dashboard.livepeer.org";
  const req = new Request("https://dashboard.livepeer.org/token");
  assert.equal(isAllowedMcpResource(req, null), true);
  assert.equal(isAllowedMcpResource(req, ""), true);
  assert.equal(
    isAllowedMcpResource(req, "https://dashboard.livepeer.org/api/mcp"),
    true
  );
  assert.equal(
    isAllowedMcpResource(req, "https://evil.example/api/mcp"),
    false
  );
});

test("consoleLoginUrl sends MCP clients straight to Auth0", () => {
  process.env.MCP_PUBLIC_ORIGIN = "https://dashboard.livepeer.org";
  const req = new Request("https://dashboard.livepeer.org/authorize");
  const url = new URL(consoleLoginUrl(req));
  assert.equal(url.origin, "https://dashboard.livepeer.org");
  assert.equal(url.pathname, "/auth/login");
  assert.equal(url.searchParams.get("returnTo"), "/api/mcp/oauth/callback");
  assert.equal(url.searchParams.get("mcp_oauth"), null);
});
