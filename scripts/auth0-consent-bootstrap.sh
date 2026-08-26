#!/usr/bin/env bash
#
# Bootstrap the Auth0 tenant so Auth0 renders the end-user consent screen for
# pymthouse-backed capabilities, while pymthouse keeps minting via Builder M2M.
#
# What it does (idempotent):
#   1. Upserts an Auth0 Resource Server (custom API) whose scope descriptions are
#      copied verbatim from pymthouse src/lib/oidc/scopes.ts, so the consent copy
#      matches the screen it replaces.
#   2. Turns OFF consent-skipping for first-party clients on that API, which is
#      what actually makes the prompt appear.
#   3. Optionally creates a dedicated application, only if you want the MCP
#      bridge isolated from Console's dashboard login client.
#
# Consent only triggers when a client requests this API as `audience`. Console's
# normal dashboard login passes no audience, so it stays prompt-free without
# needing a separate client.
#
# Usage:
#   DRY_RUN=1 ./scripts/auth0-consent-bootstrap.sh     # print planned calls
#   ./scripts/auth0-consent-bootstrap.sh               # apply
#
# Requires: auth0 CLI (>=1.32), jq, and `auth0 login` against the target tenant.

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

: "${AUTH0_DOMAIN:=}"
: "${API_IDENTIFIER:=https://api.livepeer.org/pymthouse}"
: "${API_NAME:=Livepeer Media (pymthouse)}"
: "${TOKEN_LIFETIME:=3600}"
: "${DRY_RUN:=0}"

# Set CREATE_APP=1 only if you want a dedicated Auth0 app for the MCP bridge
# instead of reusing Console's AUTH0_CLIENT_ID.
: "${CREATE_APP:=0}"
: "${APP_NAME:=Livepeer Agent MCP}"
: "${APP_CALLBACKS:=http://localhost:3000/auth/callback,https://console.livepeer.org/auth/callback}"

# Consentable scopes ONLY.
#
# The live staging discovery document advertises:
#   openid email profile sign:job users:read users:write users:token
#   device:approve admin
#
# Deliberately excluded here:
#   - openid / email / profile        native Auth0 OIDC scopes, not custom-API scopes
#   - users:* / device:approve / admin  server-side Builder M2M scopes. These are
#     never user-consented, and pymthouse's assertSignJobNotMixedWithAdmin()
#     rejects any token mixing them with sign:job.
#
# Keep descriptions in sync with pymthouse src/lib/oidc/scopes.ts — Auth0 renders
# `description` as the consent line item.
read -r -d '' SCOPES_JSON <<'JSON' || true
[
  {
    "value": "sign:job",
    "description": "Access all remote signer endpoints, including discovery and payment signing"
  }
]
JSON

# ── Helpers ───────────────────────────────────────────────────────────────────

log()  { printf '\033[1;34m>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32mOK\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mX\033[0m %s\n' "$*" >&2; exit 1; }

# Run an auth0 CLI call, or print it under DRY_RUN.
a0() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '\033[2m  would run: auth0 %s\033[0m\n' "$*" >&2
    echo '{}'
    return 0
  fi
  auth0 "$@"
}

# ── Preflight ─────────────────────────────────────────────────────────────────

command -v auth0 >/dev/null 2>&1 || die "auth0 CLI not found. brew install auth0/auth0-cli/auth0"
command -v jq    >/dev/null 2>&1 || die "jq not found."

active_tenant="$(auth0 tenants list --json 2>/dev/null \
  | jq -r '(.[] | select(.active == true) | .name) // empty' || true)"

if [[ -z "$active_tenant" ]]; then
  # Older CLI builds omit `active` in --json; fall back to the marked row.
  active_tenant="$(auth0 tenants list 2>/dev/null | awk '/→/ {print $2}' | head -1)"
fi

[[ -n "$active_tenant" ]] || die "No active Auth0 tenant. Run: auth0 login"

if [[ -n "$AUTH0_DOMAIN" && "$AUTH0_DOMAIN" != "$active_tenant" ]]; then
  die "Active tenant is '$active_tenant' but AUTH0_DOMAIN='$AUTH0_DOMAIN'.
     Switch with: auth0 tenants use $AUTH0_DOMAIN"
fi

log "Tenant:  $active_tenant"
log "API:     $API_NAME <$API_IDENTIFIER>"
log "Scopes:  $(echo "$SCOPES_JSON" | jq -r '[.[].value] | join(", ")')"
[[ "$DRY_RUN" == "1" ]] && warn "DRY_RUN=1 — no changes will be made."

# ── 1. Upsert the Resource Server (custom API) ────────────────────────────────

log "Listing resource servers (also verifies the CLI session)..."

# `auth0 tenants list` reads local config and succeeds even when the stored
# credential is expired, so it cannot be used as an auth check. `auth0 api`
# prompts interactively to re-authorize, which would hang a script — redirect
# stdin from /dev/null and cap it with timeout so it fails fast instead.
api_list_raw="$(timeout 30 auth0 api get "resource-servers" </dev/null 2>/dev/null || true)"

if ! echo "$api_list_raw" | jq -e 'type == "array"' >/dev/null 2>&1; then
  die "Could not list resource servers for '$active_tenant'.
     The usual cause is an expired CLI session. Re-authorize with:
       auth0 login
     and complete the browser confirmation (a declined prompt leaves the old
     session in place). Then re-run this script."
fi

existing_api="$(echo "$api_list_raw" \
  | jq -c --arg id "$API_IDENTIFIER" 'map(select(.identifier == $id)) | first // empty')"

# skip_consent_for_verifiable_first_party_clients=false is the switch that makes
# Auth0 show the consent prompt to first-party clients requesting this audience.
api_payload="$(jq -n \
  --arg name "$API_NAME" \
  --arg identifier "$API_IDENTIFIER" \
  --argjson scopes "$SCOPES_JSON" \
  --argjson lifetime "$TOKEN_LIFETIME" \
  '{
     name: $name,
     identifier: $identifier,
     scopes: $scopes,
     signing_alg: "RS256",
     token_lifetime: $lifetime,
     allow_offline_access: false,
     skip_consent_for_verifiable_first_party_clients: false,
     enforce_policies: false
   }')"

if [[ -n "$existing_api" ]]; then
  api_id="$(echo "$existing_api" | jq -r '.id')"
  ok "Found existing API (id: $api_id) — patching scopes + consent flag."
  # identifier is immutable on update; strip it.
  patch_payload="$(echo "$api_payload" | jq 'del(.identifier)')"
  a0 api patch "resource-servers/${api_id}" --data "$patch_payload" >/dev/null
  ok "Patched resource server."
else
  log "Creating resource server..."
  created="$(a0 api post "resource-servers" --data "$api_payload")"
  api_id="$(echo "$created" | jq -r '.id // "dry-run"')"
  ok "Created resource server (id: $api_id)."
fi

# ── 2. Optional dedicated application ─────────────────────────────────────────

mcp_client_id=""
if [[ "$CREATE_APP" == "1" ]]; then
  log "Looking up existing application '$APP_NAME'..."
  existing_app="$(auth0 apps list --json 2>/dev/null \
    | jq -c --arg n "$APP_NAME" 'map(select(.name == $n)) | first // empty' || true)"

  if [[ -n "$existing_app" ]]; then
    mcp_client_id="$(echo "$existing_app" | jq -r '.client_id')"
    ok "Reusing application (client_id: $mcp_client_id)."
  else
    log "Creating regular web application..."
    created_app="$(a0 apps create \
      --name "$APP_NAME" \
      --type regular \
      --auth-method "Post" \
      --callbacks "$APP_CALLBACKS" \
      --logout-urls "$APP_CALLBACKS" \
      --json)"
    mcp_client_id="$(echo "$created_app" | jq -r '.client_id // "dry-run"')"
    ok "Created application (client_id: $mcp_client_id)."
    warn "Retrieve the secret with: auth0 apps show $mcp_client_id -r --json | jq -r .client_secret"
    warn "Never commit it. Put it in Console's .env only."
  fi
else
  log "CREATE_APP=0 — reusing Console's existing AUTH0_CLIENT_ID."
fi

# ── 3. Report ─────────────────────────────────────────────────────────────────

echo
ok "Done."
cat <<EOF

Add to Console .env (no secrets in git):

  AUTH0_MCP_AUDIENCE=$API_IDENTIFIER
  AUTH0_MCP_SCOPES=openid profile email sign:job
EOF

if [[ -n "$mcp_client_id" && "$mcp_client_id" != "dry-run" ]]; then
  cat <<EOF
  AUTH0_MCP_CLIENT_ID=$mcp_client_id
  AUTH0_MCP_CLIENT_SECRET=<auth0 apps show $mcp_client_id -r --json | jq -r .client_secret>
EOF
fi

client_for_test="${mcp_client_id:-\$AUTH0_CLIENT_ID}"
cat <<EOF

Verify the consent screen actually renders:

  auth0 test login $client_for_test \\
    --audience "$API_IDENTIFIER" \\
    --scopes "openid profile email sign:job"

If no prompt appears, the cause is almost always one of:
  - the authorize call omitted 'audience' (Auth0 shows no consent without it)
  - consent was already granted for this user+client+scope pair; force it with
    prompt=consent
  - skip_consent_for_verifiable_first_party_clients is still true on the API

Inspect current state:

  auth0 api get "resource-servers" | jq '.[] | select(.identifier=="$API_IDENTIFIER")'
EOF
