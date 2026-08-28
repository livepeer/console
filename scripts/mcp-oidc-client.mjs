#!/usr/bin/env node
/**
 * RFC 8414 + RFC 7636 + RFC 8252 public client against Agent's MCP AS.
 *
 * Uses `openid-client` (already a dependency of @auth0/nextjs-auth0) — the same
 * certified stack Auth0's Next.js SDK uses — instead of a fixed :8765 harness.
 *
 *   MCP_AS=http://localhost:3002 node scripts/mcp-oidc-client.mjs
 *
 * Binds an ephemeral loopback port, prints the authorize URL, then exchanges
 * the code for mcp_at_*. Storyboard must allow `http://127.0.0.1:*`.
 */

import http from "node:http";
import * as client from "openid-client";

const issuer = new URL((process.env.MCP_AS ?? "http://localhost:3002").replace(/\/$/, ""));

const server = http.createServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const { port } = server.address();
const redirectUri = `http://127.0.0.1:${port}/cb`;

const config = await client.discovery(
  issuer,
  "livepeer-mcp-oidc-smoke",
  { token_endpoint_auth_method: "none" },
  client.None(),
  {
    algorithm: "oauth2",
    execute: [client.allowInsecureRequests],
  }
);

const codeVerifier = client.randomPKCECodeVerifier();
const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
const state = client.randomState();

const authorizeUrl = client.buildAuthorizationUrl(config, {
  redirect_uri: redirectUri,
  response_type: "code",
  code_challenge: codeChallenge,
  code_challenge_method: "S256",
  state,
});

console.log("OIDC client (openid-client, OAuth 2.0 AS discovery)");
console.log(`  issuer:       ${issuer.origin}`);
console.log(`  redirect_uri: ${redirectUri}`);
console.log(`  authorize:\n${authorizeUrl.href}\n`);

const callbackUrl = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error("timed out waiting for authorize redirect (5m)"));
  }, 5 * 60 * 1000);
  server.on("request", (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (url.pathname !== "/cb") {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("MCP OIDC client received the callback. You can close this tab.");
    clearTimeout(timeout);
    resolve(url);
  });
});

server.close();

const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
  pkceCodeVerifier: codeVerifier,
  expectedState: state,
  idTokenExpected: false,
});

const access = tokens.access_token;
if (!access) {
  console.error("token response missing access_token:", tokens);
  process.exit(1);
}
console.log("token_type:", tokens.token_type ?? "Bearer");
console.log("expires_in:", tokens.expires_in ?? "(none)");
console.log("access_token prefix:", `${access.slice(0, 12)}…`);
if (!access.startsWith("mcp_at_")) {
  console.error("expected mcp_at_* access token");
  process.exit(1);
}
