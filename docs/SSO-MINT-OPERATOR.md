# Console SSO + mint operator note

Console is the MCP resource server **and** OAuth authorization server at `/api/mcp`. Clients (Claude, Codex, Hermes) talk to Console. PymtHouse is billing/signer only — never the thing an MCP client talks to. Do not commit secret values.

Canonical MCP URL: `{APP_BASE_URL}/api/mcp`.

## Console env

```bash
# HMAC for DCR / PKCE / auth codes. Falls back to MCP_OAUTH_BRIDGE_SECRET or AUTH0_SECRET.
MCP_AS_SECRET=
# Optional public origin override (else APP_BASE_URL / Vercel production URL).
# MCP_PUBLIC_ORIGIN=https://dashboard.livepeer.org
DISCOVERY_SERVICE_URL=https://discovery-service-production-8955.up.railway.app/v1/discovery/raw
# PYMTHOUSE_SIGNER_URL=https://signer.pymthouse.com

# Legacy agent-mcp S2S (keep while the standalone host is still live).
# Unset secret/allowlist → mint/refresh/signer-session 404.
# MCP_INTERNAL_MINT_SECRET=
# MCP_INTERNAL_MINT_ALLOWLIST=https://agent.eliteencoder.net
# MCP_OAUTH_REDIRECT_ALLOWLIST=https://agent.eliteencoder.net/api/mcp/oauth/callback
# MCP_OAUTH_BRIDGE_SECRET=         # falls back to mint secret or AUTH0_SECRET
PYMTHOUSE_ISSUER_URL=https://pymthouse.com/api/v1/oidc
PYMTHOUSE_PUBLIC_CLIENT_ID=app_98575870d7ae33589a3f0660   # required in non-prod
PYMTHOUSE_M2M_CLIENT_ID=m2m_…
PYMTHOUSE_M2M_CLIENT_SECRET=pmth_cs_…
```

First-party `/token` mints in-process: PymtHouse **user JWT + Console-wrapped refresh** (`mcp_rt_*`). Inference exchanges the user JWT for a ~5-minute Signer JWT via M2M token-exchange. No composite API keys.

## Parallel agent-mcp (legacy)

The standalone agent-mcp host still mints through Console S2S:

- `POST /api/internal/mcp/mint` — identity `code` from Console login
- `POST /api/internal/mcp/refresh` — `{ refresh_token }`
- `POST /api/internal/mcp/signer-session` — `{ access_token }`

Missing secret or empty allowlist → **404**. Wrong Bearer → **401**. Bad `Origin` / `X-Mcp-Caller-Origin` → **403**. Wrong billing app in non-prod → **503** `billing_app_mismatch`.

Legacy login: `GET /login?mcp_oauth=1&state=…&redirect_uri=https://agent.eliteencoder.net/api/mcp/oauth/callback` → Auth0 → callback with `state` + `external_user_id` + identity `code`.

`/device` is the third-party initiate UI for PymtHouse device approval. MCP clients must not start device grants against PymtHouse.

## Client setup

See [mcp-connectors.md](./mcp-connectors.md). Production Console must be publicly reachable (Deployment Protection off). Preview deploys with protection cannot be used as MCP URLs.
