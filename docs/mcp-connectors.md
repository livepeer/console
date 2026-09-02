# MCP connectors

Paste **only** this URL. Do not add headers, API keys, or a Vercel bypass query param.

```
https://<APP_BASE_URL>/api/mcp
```

The server is Streamable HTTP. OAuth is DCR + PKCE on this origin. Browser login is Console Auth0. Access tokens are PymtHouse user JWTs (`sign:job`); refresh is Console-wrapped (`mcp_rt_*`).

## Claude

Settings → Connectors → Add custom connector. Paste the MCP URL.

Claude will:

1. Hit `/api/mcp`, receive `401` + `WWW-Authenticate` with `resource_metadata`
2. Read Protected Resource Metadata (`authorization_servers` = this origin)
3. Register (DCR) and run PKCE against this host
4. Open a browser. Sign in with Console Auth0
5. Store the user JWT + refresh token

## Codex

Add a Streamable HTTP MCP server in `~/.codex/config.toml` and log in:

```toml
[mcp_servers.livepeer]
url = "https://<APP_BASE_URL>/api/mcp"
```

```bash
codex mcp login livepeer
```

Codex uses a loopback redirect (`http://127.0.0.1:<port>/…`). Complete the Console Auth0 browser login. Do not invent API keys. Do not call PymtHouse URLs.

## Hermes

```bash
hermes mcp add livepeer --url https://<APP_BASE_URL>/api/mcp --auth oauth
hermes mcp login livepeer
```

Hermes opens a browser and waits on a loopback callback. If Hermes is a remote gateway, use its documented paste-back / desktop-relay OAuth path — the Console AS still only accepts RFC 8252 loopback redirects (plus Claude HTTPS callbacks).

## After login

Use `list_capabilities` then `run_capability` with exact capability names. Persistent apps need `endpoint`. Each `run_capability` reserves and stops; session reuse is not available. Spend is PymtHouse OpenMeter for the current UTC calendar day, 00:00–23:59 UTC (`get_cost_report` / `me_usage`); `run_capability` is refused when spendable (`hasAccess`) is exhausted.
