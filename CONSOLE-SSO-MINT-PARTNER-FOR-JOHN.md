# Livepeer Console as SSO + mint partner (for John)

**Scenario A in one line:** Livepeer Console becomes the login + credential-mint partner for Livepeer Agent MCP (same role NaaP plays today). Users sign in on Console; Agent then mints a pymthouse composite server-to-server and can run MCP **keyless**. Console only owns the login bridge and mint API — not the MCP broker itself.

---

## Links

| What | Link |
|------|------|
| Agent / Storyboard contract + gap matrix | [storyboard#1192](https://github.com/livepeer/storyboard/pull/1192) (§4 + §12) |
| Console Auth0 baseline (already shipped) | [console#14](https://github.com/livepeer/console/pull/14) |
| NaaP mint reference (merged) | [naap#458](https://github.com/livepeer/naap/pull/458) — `POST /api/internal/mcp/mint` |
| Hosts | MCP: `https://agent.livepeer.org` · Callback: `https://agent.livepeer.org/api/mcp/oauth/callback` |

---

## What’s already on Console

- **Auth0 UI login** from [console#14](https://github.com/livepeer/console/pull/14) — session + Auth0 `sub` as stable subject. **Don’t redo this**; extend it for MCP query params and post-login redirect.

---

## What Console still needs

Think of two small surfaces plus env/wiring:

### 1. Login bridge (browser)

Agent sends the user to Console:

`/login?mcp_oauth=1&state=…&redirect_uri=https://agent.livepeer.org/api/mcp/oauth/callback`

Console should:

- Capture `state` + `redirect_uri` (short-lived signed cookie)
- Run Auth0 **without** forcing `returnTo=/home` on this path
- After login, redirect to the Agent callback with the same `state`, `external_user_id` (Console `eu_<sha256(sub)>`, not raw Auth0 `sub`), one-time `code`, optional `email`
- Allowlist redirects only (Agent callback + previews); reject open redirects

### 2. Internal mint API (server-to-server)

`POST /api/internal/mcp/mint` — Bearer shared secret, caller-origin allowlist (e.g. `https://agent.livepeer.org`), body `{ code, label? }` (`code` from the login callback). Subject is taken from the code, not a free-form `externalUserId`.

On success return **only** `{ "apiKey": "app_…_pmth_…" }`. Fail closed: missing secret/allowlist → **404**, bad Bearer → **401**, bad origin → **403**, missing/invalid code → **400**/**401**, wrong billing app in non-prod → **503**. Match NaaP fail-closed mint auth; do not invent a JWT-only mint path.

### 3. Allowlists, pymthouse M2M, env

- Mint secret + caller-origin allowlist (shared with Agent / Storyboard)
- Redirect allowlist for the login bridge
- pymthouse M2M client id/secret + issuer; non-prod billing app pinned to the RS-2 test app (`app_98575870d7ae33589a3f0660`)
- Short operator note: Console URLs ↔ Agent `SSO_MINT_*` (or today’s `NAAP_MCP_*` fallbacks) — no secrets in git

**Suggested PR slices (optional):** (A) login bridge · (B) mint + M2M · (C) env docs + smokes · (D) bind mint to login `code` (no free-form subject).

---

## Explicitly out of scope for Console

- Agent MCP OAuth broker, PRM, `mcp_at_*` store, Auth Resolution
- Live Runner / SDK / signer / billing dispatch
- Scenario B (pymthouse-direct OIDC)
- Storyboard-side `SSO_MINT_*` wiring (Agent repo owns that)
- Redoing Auth0 UI from #14
- Billing settings UI / device-code flows

---

## Done means

A user can hit Console login with `mcp_oauth=1`, finish Auth0, and land on `https://agent.livepeer.org/api/mcp/oauth/callback` with echoed `state`, hashed `external_user_id`, and `code`. Agent mints with that `code` (shared secret) and gets a composite `apiKey` (never logged). Preview smokes show the fail-closed matrix (404/401/403/200). At that point Storyboard can point `SSO_MINT_*` at Console for Scenario A parity with NaaP — SSO → mint → `create_media` on the existing billed path.

### How we’ll verify (short)

1. Browser: MCP login URL → Auth0 → Agent callback with `state` + `eu_…` `external_user_id` + `code` (not `/home`; evil `redirect_uri` rejected).
2. Mint: unconfigured → 404; wrong Bearer → 401; bad origin → 403; body without `code` → 400; happy path `{ code }` → 200 `{ apiKey }` only (inspect locally, don’t paste secrets into Slack/CI).

---

*Detailed agent implementation brief (paste into Claude/Codex in the Console repo): [`docs/CONSOLE-SSO-MINT-PARTNER-BUILD-LIST.md`](./CONSOLE-SSO-MINT-PARTNER-BUILD-LIST.md)*
