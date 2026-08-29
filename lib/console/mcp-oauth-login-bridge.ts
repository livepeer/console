import { createHmac, timingSafeEqual } from "node:crypto";

export const MCP_OAUTH_PENDING_COOKIE = "mcp_oauth_pending";
const PENDING_TTL_MS = 10 * 60 * 1000;
const MAX_STATE_CHARS = 512;

export type McpOauthPending = {
  state: string;
  redirectUri: string;
};

function bridgeSecret(): string {
  return (
    process.env.MCP_OAUTH_BRIDGE_SECRET?.trim() ||
    process.env.MCP_INTERNAL_MINT_SECRET?.trim() ||
    process.env.AUTH0_SECRET?.trim() ||
    ""
  );
}

export function parseMintAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function mcpOauthRedirectAllowlist(): string[] {
  const explicit = parseMintAllowlist(process.env.MCP_OAUTH_REDIRECT_ALLOWLIST);
  if (explicit.length > 0) return explicit;
  return parseMintAllowlist(process.env.MCP_INTERNAL_MINT_ALLOWLIST).map(
    (origin) => `${origin.replace(/\/$/, "")}/api/mcp/oauth/callback`
  );
}

export function isAllowedMcpRedirectUri(redirectUri: string): boolean {
  return mcpOauthRedirectAllowlist().includes(redirectUri);
}

export function parseMcpOauthLoginQuery(input: {
  mcpOauth?: string;
  state?: string;
  redirectUri?: string;
}): { ok: true; pending: McpOauthPending } | { ok: false; error: string } {
  if (input.mcpOauth !== "1") {
    return { ok: false, error: "mcp_oauth_inactive" };
  }
  const state = input.state?.trim() ?? "";
  const redirectUri = input.redirectUri?.trim() ?? "";
  if (!state || state.length > MAX_STATE_CHARS) {
    return { ok: false, error: "invalid_state" };
  }
  if (!redirectUri || !isAllowedMcpRedirectUri(redirectUri)) {
    return { ok: false, error: "invalid_redirect_uri" };
  }
  return { ok: true, pending: { state, redirectUri } };
}

export function encodeMcpOauthPendingCookie(pending: McpOauthPending): string {
  const secret = bridgeSecret();
  if (!secret) {
    throw new Error("MCP OAuth bridge secret is not configured");
  }
  const payload = Buffer.from(
    JSON.stringify({
      ...pending,
      exp: Date.now() + PENDING_TTL_MS,
    }),
    "utf8"
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function decodeMcpOauthPendingCookie(
  value: string | undefined
): McpOauthPending | null {
  if (!value) return null;
  const secret = bridgeSecret();
  if (!secret) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      state?: unknown;
      redirectUri?: unknown;
      exp?: unknown;
    };
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.redirectUri !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    if (!isAllowedMcpRedirectUri(parsed.redirectUri)) {
      return null;
    }
    return { state: parsed.state, redirectUri: parsed.redirectUri };
  } catch {
    return null;
  }
}

export function buildMcpOauthCallbackUrl(input: {
  redirectUri: string;
  state: string;
  externalUserId: string;
  email?: string;
}): string {
  const url = new URL(input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("external_user_id", input.externalUserId);
  if (input.email) {
    url.searchParams.set("email", input.email);
  }
  return url.toString();
}

export const MCP_OAUTH_COMPLETE_PATH = "/api/v1/auth/mcp/complete";
