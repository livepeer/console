# Console SSO + mint operator note

Console is the Scenario A login + mint partner for Livepeer Agent MCP. Do not commit secret values.

## Console env

```bash
MCP_INTERNAL_MINT_SECRET=          # shared with Storyboard
MCP_INTERNAL_MINT_ALLOWLIST=https://agent.livepeer.org
# MCP_OAUTH_REDIRECT_ALLOWLIST=https://agent.livepeer.org/api/mcp/oauth/callback
# MCP_OAUTH_BRIDGE_SECRET=         # falls back to mint secret or AUTH0_SECRET
PYMTHOUSE_ISSUER_URL=https://pymthouse.com/api/v1/oidc
# Public sibling of the M2M (Builder path id until Console infers it from M2M)
PYMTHOUSE_PUBLIC_CLIENT_ID=app_…
PYMTHOUSE_M2M_CLIENT_ID=m2m_…
PYMTHOUSE_M2M_CLIENT_SECRET=pmth_cs_…
```

Mint is `POST /api/internal/mcp/mint` with `{ "code": "mcp_id_…" }` from the login callback. Missing secret or empty allowlist → **404**. Wrong Bearer → **401**. Bad `Origin` / `X-Mcp-Caller-Origin` → **403**. Missing/invalid code → **400** / **401**. The billed app is the public sibling of the configured M2M — mint does not pin a hard-coded test app id. Free-form `externalUserId` is not a mint subject.

Login: `GET /login?mcp_oauth=1&state=…&redirect_uri=https://agent.livepeer.org/api/mcp/oauth/callback` → Auth0 → callback with `state` + `external_user_id` (`eu_<sha256>` of Auth0 `sub`, same as Console keys) + `code`. Optional redeem: `POST /api/v1/auth/mcp/identity` `{ "code" }`.

## Storyboard / Agent

```bash
MCP_OAUTH_ENABLED=1
MCP_OAUTH_PROVIDER=sso_mint
SSO_MINT_ORIGIN=https://<console-host>
SSO_MINT_URL=https://<console-host>/api/internal/mcp/mint
SSO_MINT_SECRET=<same as MCP_INTERNAL_MINT_SECRET>
SSO_MINT_CALLER_ORIGIN=https://agent.livepeer.org
```

Until `SSO_MINT_*` lands, equivalent names may be `NAAP_MCP_ORIGIN` / `NAAP_MCP_MINT_URL` / `MCP_INTERNAL_MINT_*`.

After mint, Agent may call PymtHouse `GET /api/v1/apps/{app}/me/billing/*` with the composite Bearer. The minted JWT carries `billing_mode`. On **owner_rollup** (RS-2 default) skip money `/me/billing/*` — those routes return **403** `merchant_billing_required` because usage is billed to the app owner. Do not fall back to the M2M owner wallet (that discloses the shared pool). Merchant-mode JWTs may call the money routes.

Do not retry those 403s via M2M `GET …/users/{id}/allowances` (that is the owner wallet).
