import assert from "node:assert/strict";
import { test } from "node:test";

import {
  authorizeMcpMint,
  billingAppMismatch,
  mintRouteConfigured,
  RS2_TEST_BILLING_APP_ID,
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

test("billingAppMismatch pins RS-2 in non-prod", () => {
  const prev = process.env.VERCEL_ENV;
  const prevBase = process.env.APP_BASE_URL;
  process.env.VERCEL_ENV = "preview";
  delete process.env.APP_BASE_URL;
  process.env.PYMTHOUSE_PUBLIC_CLIENT_ID = "app_deadbeefdeadbeefdeadbeef";
  assert.equal(billingAppMismatch()?.error, "billing_app_mismatch");
  process.env.PYMTHOUSE_PUBLIC_CLIENT_ID = RS2_TEST_BILLING_APP_ID;
  assert.equal(billingAppMismatch(), null);
  process.env.PYMTHOUSE_PUBLIC_CLIENT_ID = "app_deadbeefdeadbeefdeadbeef";
  process.env.APP_BASE_URL = "http://localhost:3000";
  assert.equal(billingAppMismatch(), null);
  if (prev === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = prev;
  if (prevBase === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = prevBase;
});
