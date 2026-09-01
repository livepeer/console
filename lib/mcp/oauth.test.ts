import assert from "node:assert/strict";
import { test } from "node:test";

import { isAllowedMcpResource } from "./oauth";

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
