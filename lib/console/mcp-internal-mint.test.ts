import assert from "node:assert/strict";
import { test } from "node:test";

import {
  authorizeMcpMint,
  mintRouteConfigured,
} from "./mcp-internal-mint.ts";

test("mintRouteConfigured requires secret and allowlist", () => {
  delete process.env.MCP_INTERNAL_MINT_SECRET;
  delete process.env.MCP_INTERNAL_MINT_ALLOWLIST;
  assert.equal(mintRouteConfigured(), false);
  process.env.MCP_INTERNAL_MINT_SECRET = "shared";
  process.env.MCP_INTERNAL_MINT_ALLOWLIST = "https://agent.livepeer.org";
  assert.equal(mintRouteConfigured(), true);
});

test("authorizeMcpMint fail-closed matrix", () => {
  process.env.MCP_INTERNAL_MINT_SECRET = "shared";
  process.env.MCP_INTERNAL_MINT_ALLOWLIST = "https://agent.livepeer.org";
  assert.equal(
    authorizeMcpMint({
      authorization: "Bearer wrong",
      origin: null,
      callerOrigin: "https://agent.livepeer.org",
    }).ok,
    false
  );
  assert.deepEqual(
    authorizeMcpMint({
      authorization: "Bearer shared",
      origin: null,
      callerOrigin: "https://evil.example",
    }),
    { ok: false, status: 403, error: "forbidden" }
  );
  assert.deepEqual(
    authorizeMcpMint({
      authorization: "Bearer shared",
      origin: null,
      callerOrigin: "https://agent.livepeer.org",
    }),
    { ok: true }
  );
});
