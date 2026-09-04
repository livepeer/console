# MCP connectors

Paste **only** this URL. Do not add headers, API keys, or a Vercel bypass query param.

```
https://<APP_BASE_URL>/api/mcp
```

The server is Streamable HTTP. OAuth is CIMD + DCR + PKCE on this origin. Browser login is Console Auth0. Access tokens are PymtHouse user JWTs (`sign:job`); refresh is Console-wrapped (`mcp_rt_*`). Codex, ChatGPT, and Hermes prefer CIMD when the AS advertises `client_id_metadata_document_supported`.

## Claude

Settings → Connectors → Add custom connector. Paste the MCP URL.

Claude will:

1. Hit `/api/mcp`, receive `401` + `WWW-Authenticate` with `resource_metadata`
2. Read Protected Resource Metadata (`authorization_servers` = this origin)
3. Register (DCR) and run PKCE against this host
4. Open a browser. Sign in with Console Auth0
5. Store the user JWT + refresh token

## Cursor

Add a Streamable HTTP MCP server in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "livepeer-agent": {
      "type": "http",
      "url": "https://<APP_BASE_URL>/api/mcp"
    }
  }
}
```

Cursor DCR registers `cursor://anysphere.cursor-mcp/oauth/callback` (desktop) and/or `https://www.cursor.com/agents/mcp/oauth/callback` (web / agents). Complete the Console Auth0 browser login. `http://localhost:8787/callback` is already covered as RFC 8252 loopback.

## Codex

In Codex Desktop: Settings → MCP servers → Add server. Transport **Streamable HTTP**, URL `https://<APP_BASE_URL>/api/mcp`, then Authenticate.

Or add it in `~/.codex/config.toml` (shared with Desktop / CLI / the IDE extension) and log in:

```toml
[mcp_servers.livepeer]
url = "https://<APP_BASE_URL>/api/mcp"
```

```bash
codex mcp login livepeer
```

Codex identifies itself with a ChatGPT-hosted CIMD document (`https://chatgpt.com/oauth/codex/…/client.json`) and a loopback redirect (`http://127.0.0.1:<port>/callback/<id>`). The AS accepts RFC 8252 variable ports and `127.0.0.1` ↔ `localhost`. Complete the Console Auth0 browser login. Do not invent API keys. Do not call PymtHouse URLs.

## ChatGPT

ChatGPT connectors use the same CIMD host. Allowlisted callbacks are `https://chatgpt.com/connector/oauth/<callback_id>` and the legacy `https://chatgpt.com/connector_platform_oauth_redirect`. Paste the MCP URL as a custom connector; sign in when the browser opens.

## Hermes

```bash
hermes mcp add livepeer --url https://<APP_BASE_URL>/api/mcp --auth oauth
hermes mcp login livepeer
```

Hermes identifies itself with a GitHub Pages CIMD document (`https://nousresearch.github.io/hermes-agent/docs/oauth/client-metadata.json`) and a loopback callback (`http://127.0.0.1:<port>/callback`). If Hermes is a remote gateway, use its documented paste-back / desktop-relay OAuth path.

## After login

Use `list_capabilities` then `run_capability` with exact capability names. `run_capability` blocks until the runner finishes (up to 13 minutes) and polls fal `status_url` when a queue receipt comes back instead of media. If the queue URL is not pollable, the tool returns `status_url` / `request_id` rather than `url: null`. Spend is PymtHouse OpenMeter for the current UTC calendar day, 00:00–23:59 UTC (`get_cost_report` / `me_usage`); `run_capability` is refused when spendable (`hasAccess`) is exhausted.
