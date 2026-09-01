# Console SSO + MCP operator note

Console is the MCP resource server **and** OAuth authorization server at `/api/mcp`. Clients (Claude, Codex, Hermes) talk to Console. PymtHouse is billing/signer only — never the thing an MCP client talks to. Do not commit secret values.

Canonical MCP URL: `{APP_BASE_URL}/api/mcp`.

## Console env

```bash
# HMAC for DCR / PKCE / auth codes. Falls back to MCP_OAUTH_BRIDGE_SECRET or AUTH0_SECRET.
MCP_AS_SECRET=
# Optional public origin override (else APP_BASE_URL / Vercel production URL).
# MCP_PUBLIC_ORIGIN=https://dashboard.livepeer.org
# MCP_OAUTH_BRIDGE_SECRET=
DISCOVERY_SERVICE_URL=https://discovery-service-production-8955.up.railway.app/v1/discovery/raw
# PYMTHOUSE_SIGNER_URL=https://signer.pymthouse.com

PYMTHOUSE_ISSUER_URL=https://pymthouse.com/api/v1/oidc
PYMTHOUSE_PUBLIC_CLIENT_ID=app_98575870d7ae33589a3f0660   # required in non-prod
PYMTHOUSE_M2M_CLIENT_ID=m2m_…
PYMTHOUSE_M2M_CLIENT_SECRET=pmth_cs_…
```

`POST /token` mints in-process: PymtHouse **user JWT + Console-wrapped refresh** (`mcp_rt_*`). Inference exchanges the user JWT for a ~5-minute Signer JWT via M2M token-exchange. No composite API keys.

Wrong billing app in non-prod → mint fails with `billing_app_mismatch`.

`/device` is the third-party initiate UI for PymtHouse device approval. MCP clients must not start device grants against PymtHouse.

## Client setup

See [mcp-connectors.md](./mcp-connectors.md). Production Console must be publicly reachable (Deployment Protection off). Preview deploys with protection cannot be used as MCP URLs.
