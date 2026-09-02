const CLAUDE_HOSTS = new Set(["claude.ai", "claude.com"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const CURSOR_HTTPS_HOSTS = new Set(["www.cursor.com", "cursor.com"]);

function hostnameOf(parsed: URL): string {
  return parsed.hostname.replace(/^\[|\]$/g, "");
}

export function isAllowedClientRedirectUri(redirectUri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) return false;

  const host = hostnameOf(parsed);

  if (parsed.protocol === "https:" && CLAUDE_HOSTS.has(host)) {
    return (
      parsed.pathname === "/api/mcp/auth_callback" ||
      parsed.pathname.endsWith("/api/mcp/auth_callback")
    );
  }

  // RFC 8252 native-app loopback: any path on 127.0.0.1 / localhost / ::1.
  if (parsed.protocol === "http:" && LOOPBACK_HOSTS.has(host)) {
    return true;
  }

  // Cursor desktop DCR still registers the custom-scheme callback on some
  // builds. Web / Cursor Agents use the www.cursor.com HTTPS callback.
  if (parsed.protocol === "cursor:") {
    return host === "anysphere.cursor-mcp" && parsed.pathname === "/oauth/callback";
  }
  if (parsed.protocol === "https:" && CURSOR_HTTPS_HOSTS.has(host)) {
    return parsed.pathname === "/agents/mcp/oauth/callback";
  }

  return false;
}

export function normalizeRedirectUris(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 8) return null;
  const uris: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || item.length > 512) return null;
    const uri = item.trim();
    if (!uri || !isAllowedClientRedirectUri(uri)) return null;
    uris.push(uri);
  }
  return uris;
}
