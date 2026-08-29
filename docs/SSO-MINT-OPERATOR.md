# Console SSO + mint operator note

Console is the Auth0 + mint partner for Livepeer Agent MCP. Claude never talks to PymtHouse. Do not commit secret values.

## Console env

```bash
MCP_INTERNAL_MINT_SECRET=          # shared with agent-mcp SSO_MINT_SECRET
MCP_INTERNAL_MINT_ALLOWLIST=https://agent.eliteencoder.net
# MCP_OAUTH_REDIRECT_ALLOWLIST=https://agent.eliteencoder.net/api/mcp/oauth/callback
# MCP_OAUTH_BRIDGE_SECRET=         # falls back to mint secret or AUTH0_SECRET
PYMTHOUSE_ISSUER_URL=https://pymthouse.com/api/v1/oidc
PYMTHOUSE_PUBLIC_CLIENT_ID=app_98575870d7ae33589a3f0660   # required in non-prod
PYMTHOUSE_M2M_CLIENT_ID=m2m_…
PYMTHOUSE_M2M_CLIENT_SECRET=pmth_cs_…
```

Mint is `POST /api/internal/mcp/mint`. Body requires identity `code` from Console login. Response is a PymtHouse **user JWT + Console-wrapped refresh** (`mcp_rt_*`), not a composite API key and not Redis `mcp_at_*`. Missing secret or empty allowlist → **404**. Wrong Bearer → **401**. Bad `Origin` / `X-Mcp-Caller-Origin` → **403**. Wrong billing app in non-prod → **503** `billing_app_mismatch`.

Refresh: `POST /api/internal/mcp/refresh` with `{ refresh_token }` (re-mints; Console does not hold the PymtHouse `app_` client secret). Signer: `POST /api/internal/mcp/signer-session` with `{ access_token }` (5-minute Signer JWT via M2M token-exchange).

Login: `GET /login?mcp_oauth=1&state=…&redirect_uri=https://agent.eliteencoder.net/api/mcp/oauth/callback` → Auth0 → callback with `state` + `external_user_id` + identity `code`.

`/device` is the third-party initiate UI for PymtHouse device approval (`iss` / `target_link_uri` / `login_hint`). agent-mcp must not start device grants against PymtHouse.

## Agent MCP

```bash
CONSOLE_ORIGIN=https://<console-host>
SSO_MINT_SECRET=<same as MCP_INTERNAL_MINT_SECRET>
SSO_MINT_CALLER_ORIGIN=https://agent.eliteencoder.net
MCP_AS_SECRET=                     # HMAC for DCR / PKCE blobs; may equal SSO_MINT_SECRET
MCP_PUBLIC_ORIGIN=https://agent.eliteencoder.net
PYMTHOUSE_ISSUER_URL=https://pymthouse.com/api/v1/oidc   # JWKS verify only
```

agent-mcp never receives M2M or Auth0. It mints, refreshes, and exchanges signer sessions through Console S2S.
