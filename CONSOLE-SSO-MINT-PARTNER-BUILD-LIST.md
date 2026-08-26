# Agent brief: Livepeer Console — Scenario A SSO + mint partner

**Target repo:** `livepeer/console` (Next.js App Router).  
**Paste this brief into Claude/Codex working in Console.** Do not invent APIs; mirror the NaaP contract cited below.

---

## 1. Role / mission

Implement the **SSO + mint partner contract** in Livepeer Console so Livepeer Agent MCP (`livepeer/storyboard`, host `https://agent.livepeer.org`) can point `SSO_MINT_*` (or today’s `NAAP_MCP_*` fallbacks) at Console. User signs in via Console Auth0 → Agent callback receives a stable subject → Agent server-to-server mints a pymthouse composite via Console’s internal mint → Auth Resolution binds `mcp_at_*` → `create_media` uses composite `forwardBearer` on the existing signer / Live Runner billed tail (Scenario A). Console owns login bridge + mint only; **do not** build the MCP OAuth broker, `mcp_at_*` store, or LR dispatch in Console.

---

## 2. Hard constraints

| Rule | Action |
|------|--------|
| Contract fidelity | Match NaaP request/response/status semantics. Do not invent alternate mint paths, JWT-only mint, or broker routes. |
| Fail closed | Missing mint secret or empty caller allowlist → **404** (route not advertised). Wrong Bearer → **401**. Disallowed caller origin → **403**. Wrong/non-test billing app in non-prod → **503** `billing_app_mismatch`. |
| Secrets | `MCP_INTERNAL_MINT_SECRET`, `PYMTHOUSE_M2M_CLIENT_SECRET`, Auth0 secrets: **server-only**. Never log composites / secrets / `apiKey`. |
| RS-2 billing pin (non-prod) | Mint only when `PYMTHOUSE_PUBLIC_CLIENT_ID === app_98575870d7ae33589a3f0660`. Never default to a live customer app. |
| Redirect safety | Allowlist Storyboard callbacks only. Reject open redirects. Do **not** hardcode `returnTo=/home` on the MCP login path. |
| Already done | [console#14](https://github.com/livepeer/console/pull/14) Auth0 UI login — **do not redo**. Extend it for MCP params. |
| Wrong repo | Do **not** add Agent MCP broker / PRM / `mcp_at_*` / Auth Resolution / Scenario B pymthouse OIDC AS to Console. |

---

## 3. Reference implementations (source of truth)

**Workspace (NaaP):** `/Users/qiang.han/Documents/mycodespace/NaaP`  
Console repo may be absent from this workspace — implement under Console’s Next.js App Router **equivalent** of the NaaP paths below. Prefer reading NaaP files over guessing Console layout.

| Piece | NaaP source of truth | Notes |
|-------|----------------------|--------|
| Internal mint | `apps/web-next/src/app/api/internal/mcp/mint/route.ts` (+ `route.test.ts`) | Merged [naap#458](https://github.com/livepeer/naap/pull/458). Path: `POST /api/internal/mcp/mint`. |
| Builder mint helper | `apps/web-next/src/lib/pymthouse-keys-bff.ts` → `createPymthouseApiKey` | Upsert app user + `POST …/apps/{appId}/users/{externalUserId}/keys` with M2M Basic. |
| Login bridge lib | `apps/web-next/src/lib/mcp-oauth-login-bridge.ts` | Pending cookie, redirect allowlist, callback URL builder, optional identity code. |
| Login complete | `apps/web-next/src/app/api/v1/auth/mcp/complete/route.ts` | Authenticated redirect to Storyboard callback. |
| Optional identity | `apps/web-next/src/app/api/v1/auth/mcp/identity/route.ts` | `POST` `{ code }` → `{ externalUserId, email? }`. |
| Entry | NaaP `/login?mcp_oauth=1&state=…&redirect_uri=…` | Console: same query contract on `/login` (or documented authorize URL). |
| Design / plan | NaaP `MCP-OAUTH-PYMTHOUSE-DESIGN.html` Scenario A; Storyboard [PR #1192](https://github.com/livepeer/storyboard/pull/1192) §4 + §12 | Contract + Console gap matrix. |
| Auth0 baseline | [console#14](https://github.com/livepeer/console/pull/14) | Session + Auth0 `sub` as subject — already shipped. |

**Product / hosts**

| Name | Value |
|------|--------|
| Product (UI) | Livepeer Agent / Livepeer Console |
| MCP host | `https://agent.livepeer.org` |
| OAuth callback | `https://agent.livepeer.org/api/mcp/oauth/callback` |
| RS-2 test billing app | `app_98575870d7ae33589a3f0660` |

Wire/repo ids (`livepeer/storyboard`, `mcp_at_*`, env key names) stay as-is — do not “rebrand” them in code.

---

## 4. Exact contract

### 4.1 Login bridge (browser)

**Entry (Storyboard → Console)**

```
GET {SSO_MINT_ORIGIN}/login?mcp_oauth=1&state={opaque}&redirect_uri={callback}
```

| Query | Required | Rules |
|-------|----------|--------|
| `mcp_oauth` | yes | Must be `1` to engage bridge (ignore for normal Console login). |
| `state` | yes | Opaque ≤512 chars; echo unchanged on callback. |
| `redirect_uri` | yes | Exact match against redirect allowlist (see §4.4). |

**Behavior**

1. Persist pending `{ state, redirectUri }` (signed httpOnly cookie, short TTL ~10m) — see NaaP `encodeMcpOauthPendingCookie`.
2. Run Auth0 login **without** forcing `returnTo=/home` for this path.
3. After session exists, complete bridge (NaaP pattern: `GET /api/v1/auth/mcp/complete` or inline equivalent).
4. Redirect to allowlisted `redirect_uri` with:

| Param | Required | Source |
|-------|----------|--------|
| `state` | yes | Echo pending.state |
| `external_user_id` | yes | Console hashed subject `eu_<sha256(Auth0 sub)>` (same as dashboard keys). **Not** raw `auth0|…` — `|` is outside the PymtHouse charset. |
| `code` | yes | Signed login grant (`mcp_id_…`). Mint subject comes from this, not a caller-chosen id. |
| `email` | optional | Session email |

**Example success redirect**

```
https://agent.livepeer.org/api/mcp/oauth/callback?state=…&external_user_id=eu_…&code=mcp_id_…&email=user%40example.com
```

Agent must mint with `code`. Treat `external_user_id` as the canonical id to display/bind, not as a mint-input Agent can invent.

Reject disallowed `redirect_uri`. On missing session / bad pending → fail closed (login error or safe Console page — never open redirect).

### 4.2 Identity exchange (optional, server)

Agent may redeem the callback `code` without minting yet:

```
POST {SSO_MINT_ORIGIN}/api/v1/auth/mcp/identity
Content-Type: application/json

{ "code": "mcp_id_…" }
```

**200:** `{ "externalUserId": "eu_…", "email": "…" }` — hashed Console subject  
**400:** invalid JSON / missing code  
**401:** invalid or expired code  

Mint still requires the same `code`. Do not use this response as a free-form mint id.

### 4.3 Internal mint (server-to-server, connect-time only)

```
POST /api/internal/mcp/mint
Authorization: Bearer <MCP_INTERNAL_MINT_SECRET>
Content-Type: application/json
X-Mcp-Caller-Origin: https://agent.livepeer.org
# Or Origin: https://agent.livepeer.org
```

**Body**

```json
{
  "code": "mcp_id_…",
  "label": "mcp-oauth"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `code` | yes | Login grant from the callback (or identity redeem). Subject is `eu_…` inside the code. |
| `externalUserId` | no | If present must equal the code’s subject; never used as the mint id by itself |
| `email` | no | Overrides email on the grant if set |
| `label` | no | Default `"mcp-oauth"` |

**Caller origin:** Prefer `Origin`; if absent (S2S), accept `X-Mcp-Caller-Origin`. Value must be in `MCP_INTERNAL_MINT_ALLOWLIST` (exact string match).

**Success 200** — return **only**:

```json
{ "apiKey": "app_98575870d7ae33589a3f0660_pmth_<secret>" }
```

Composite shape: `app_<id>_pmth_<secret>`. Never include key metadata that leaks the secret elsewhere; never log `apiKey`.

**Status codes (match NaaP)**

| Status | When | Body example |
|--------|------|----------------|
| 404 | `MCP_INTERNAL_MINT_SECRET` or `MCP_INTERNAL_MINT_ALLOWLIST` unset/empty | `{ "error": "not_found" }` |
| 401 | Missing/wrong Bearer, or invalid/expired `code` | `{ "error": "unauthorized" }` |
| 403 | Caller origin missing or not allowlisted | `{ "error": "forbidden" }` |
| 503 | `PYMTHOUSE_PUBLIC_CLIENT_ID` ≠ `app_98575870d7ae33589a3f0660` (RS-2) | `{ "error": "billing_app_mismatch", "error_description": "…" }` |
| 400 | Bad/missing JSON, missing `code`, or `externalUserId` mismatch vs code | `{ "error": "invalid_request", … }` |
| 502 | Upstream Builder mint failure | `{ "error": "mint_failed", "error_description": "Unable to mint credential" }` — **no upstream leak** |
| 200 | Mint OK | `{ "apiKey": "…" }` |

**Implementation:** Reuse/wrap Console’s pymthouse M2M key mint (same idea as NaaP `createPymthouseApiKey`). Do not reimplement Basic auth differently from existing Console BFF if one already exists (console#3/#8 lineage).

### 4.4 Allowlists & env (Console)

| Env | Purpose |
|-----|---------|
| `MCP_INTERNAL_MINT_SECRET` | Shared Bearer with Storyboard (`SSO_MINT_SECRET` / `MCP_INTERNAL_MINT_SECRET`) |
| `MCP_INTERNAL_MINT_ALLOWLIST` | Comma-separated exact origins, e.g. `https://agent.livepeer.org` (+ Preview Agent origins) |
| `MCP_OAUTH_REDIRECT_ALLOWLIST` | Optional explicit full callback URLs; else derive `{each mint allowlist origin}/api/mcp/oauth/callback` |
| `MCP_OAUTH_BRIDGE_SECRET` | Optional cookie signing secret; may fall back to Auth0/session secret or mint secret (see NaaP) |
| `PYMTHOUSE_PUBLIC_CLIENT_ID` | Billing app id — **must** be `app_98575870d7ae33589a3f0660` in non-prod |
| `PYMTHOUSE_M2M_CLIENT_ID` | Confidential `m2m_…` |
| `PYMTHOUSE_M2M_CLIENT_SECRET` | M2M secret (server-only) |
| `PYMTHOUSE_ISSUER_URL` | e.g. `https://pymthouse.com/api/v1/oidc` |
| Auth0 vars | From console#14 — unchanged |

**Storyboard side (document for operators; do not implement in Console)**

```bash
MCP_OAUTH_ENABLED=1
MCP_OAUTH_PROVIDER=sso_mint   # or alias naap
SSO_MINT_ORIGIN=https://<console-host>
# SSO_MINT_AUTHORIZE_URL=https://<console-host>/login?mcp_oauth=1
SSO_MINT_URL=https://<console-host>/api/internal/mcp/mint
SSO_MINT_SECRET=<same as Console MCP_INTERNAL_MINT_SECRET>
SSO_MINT_CALLER_ORIGIN=https://agent.livepeer.org
MCP_OAUTH_BILLING_APP_ID=app_98575870d7ae33589a3f0660
```

Until `SSO_MINT_*` lands on Storyboard, equivalent names may be `NAAP_MCP_ORIGIN` / `NAAP_MCP_MINT_URL` / `MCP_INTERNAL_MINT_*`.

---

## 5. Deliverables (ordered PR slices)

Ship as separate Console PRs. Do not redo Auth0 from #14.

### PR-A — Login bridge

1. Read NaaP `mcp-oauth-login-bridge.ts` + `api/v1/auth/mcp/complete/route.ts`.
2. On `/login`, when `mcp_oauth=1`, capture `state` + `redirect_uri`; validate allowlist; set signed pending cookie.
3. After Auth0 session, redirect to Storyboard callback with `state` + hashed `external_user_id` (`eu_…`) + `code` + optional `email` — **not** `/home`.
4. Unit tests: allowlist reject, missing state, happy callback URL shape.

### PR-B — Internal mint + M2M

1. Port NaaP `POST /api/internal/mcp/mint` behavior (status matrix §4.3) under Console App Router equivalent path **`/api/internal/mcp/mint`** (keep path identical so Storyboard env is drop-in).
2. Wire `createPymthouseApiKey`-equivalent using Console M2M env.
3. Enforce RS-2 test-app pin → 503 otherwise.
4. Unit tests: 404/401/403/503/400/502/200 + `X-Mcp-Caller-Origin` without `Origin` (copy NaaP `route.test.ts` cases).

### PR-C — Env docs + smokes

1. Document Console env + Storyboard `SSO_MINT_*` sketch (no secret values).
2. Add curl smokes (§6) to a Console docs/test note.
3. Confirm Preview deploy: mint 404 until secrets set; then 401/403/200 matrix.

**PR-D** — Bind mint to login: issue `mcp_id_…` at complete; `POST /api/v1/auth/mcp/identity`; mint requires `code` (no free-form subject).

---

## 6. Acceptance tests / verify commands

Replace `CONSOLE_ORIGIN`, secrets, and subjects. Never print real `apiKey` in logs/CI artifacts.

### Mint — fail closed / auth matrix

```bash
CONSOLE_ORIGIN=https://<console-preview>
SECRET=dev-shared-secret   # must match Console MCP_INTERNAL_MINT_SECRET
CALLER=https://agent.livepeer.org

# Unconfigured env on a deploy without secret/allowlist → 404
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$CONSOLE_ORIGIN/api/internal/mcp/mint" \
  -H 'content-type: application/json' \
  -d '{"code":"mcp_id_smoke"}'
# expect: 404

# Wrong Bearer → 401
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$CONSOLE_ORIGIN/api/internal/mcp/mint" \
  -H "authorization: Bearer wrong" \
  -H "x-mcp-caller-origin: $CALLER" \
  -H 'content-type: application/json' \
  -d '{"code":"mcp_id_smoke"}'
# expect: 401

# Bad origin → 403
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$CONSOLE_ORIGIN/api/internal/mcp/mint" \
  -H "authorization: Bearer $SECRET" \
  -H 'x-mcp-caller-origin: https://evil.example' \
  -H 'content-type: application/json' \
  -d '{"code":"mcp_id_smoke"}'
# expect: 403

# Free-form id without login code → 400
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$CONSOLE_ORIGIN/api/internal/mcp/mint" \
  -H "authorization: Bearer $SECRET" \
  -H "x-mcp-caller-origin: $CALLER" \
  -H 'content-type: application/json' \
  -d '{"externalUserId":"smoke-user"}'
# expect: 400

# Happy path: use `code` from the login callback (inspect locally; do not commit apiKey)
curl -sS -X POST "$CONSOLE_ORIGIN/api/internal/mcp/mint" \
  -H "authorization: Bearer $SECRET" \
  -H "x-mcp-caller-origin: $CALLER" \
  -H 'content-type: application/json' \
  -d '{"code":"'"$LOGIN_CODE"'","label":"mcp-oauth"}'
# expect: {"apiKey":"app_98575870d7ae33589a3f0660_pmth_…"}
```

### Login bridge — manual / browser

1. Open:
   `https://<console>/login?mcp_oauth=1&state=test-state-1&redirect_uri=https%3A%2F%2Fagent.livepeer.org%2Fapi%2Fmcp%2Foauth%2Fcallback`
2. Complete Auth0.
3. Land on Agent callback URL with same `state=test-state-1`, `external_user_id=eu_…`, and `code=mcp_id_…` (not raw `auth0|…`, not Console `/home`).
4. Disallowed `redirect_uri=https://evil.example/cb` must not redirect there.

### Unit

Port NaaP mint `route.test.ts` cases. Add login-bridge allowlist + callback param tests.

---

## 7. Out of scope

- Storyboard MCP OAuth broker, PRM, PKCE AS, `mcp_at_*` oauth-store, Auth Resolution
- Live Runner / SDK / signer / OpenMeter changes
- Scenario B (pymthouse-direct OIDC `web_` AS + Storyboard-held M2M)
- Storyboard SM-1…SM-4 provider rename / `SSO_MINT_*` wiring (Storyboard owns)
- Replacing or redoing Console Auth0 UI from #14
- Billing settings UI, device-code flows (adjacent Console PRs — not this contract)

---

## 8. Done criteria

Mark complete only when all are true:

- [ ] `GET /login?mcp_oauth=1&state=…&redirect_uri=…` → Auth0 → Storyboard callback with echoed `state`, hashed `external_user_id` (`eu_…`), and `code`
- [ ] MCP path does not force `returnTo=/home`
- [ ] Redirect allowlist includes `https://agent.livepeer.org/api/mcp/oauth/callback` (+ previews if used); open redirects rejected
- [ ] `POST /api/internal/mcp/mint` implements §4.3 status matrix (404/401/403/503/400/502/200); subject from `code` only
- [ ] Caller allowlist includes `https://agent.livepeer.org`; accepts `X-Mcp-Caller-Origin` when `Origin` absent
- [ ] Non-prod `PYMTHOUSE_PUBLIC_CLIENT_ID` pinned to `app_98575870d7ae33589a3f0660`; mismatch → 503
- [ ] M2M env present on the deploy that hosts mint; composite never logged
- [ ] Curl smokes §6 green on Preview
- [ ] Operator note lists Console URLs + Storyboard `SSO_MINT_*` / `NAAP_MCP_*` mapping (no secrets committed)
- [ ] Ready for Storyboard to point `SSO_MINT_*` at Console for Scenario A parity (same bar as NaaP GREEN: SSO → mint → `create_media` → signer)
