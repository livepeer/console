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
  const payload = Buffer.from(
    JSON.stringify({
      ...pending,
      exp: Date.now() + PENDING_TTL_MS,
    }),
    "utf8"
  ).toString("base64url");
  return signPayload(payload);
}

export function decodeMcpOauthPendingCookie(
  value: string | undefined
): McpOauthPending | null {
  if (!value) return null;
  const payload = verifySignedPayload(value);
  if (!payload) return null;
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

export type McpIdentityGrant = {
  externalUserId: string;
  email?: string;
  state: string;
};

const IDENTITY_TTL_MS = PENDING_TTL_MS;
export const MCP_IDENTITY_CODE_PREFIX = "mcp_id_";

function signPayload(payload: string): string {
  const secret = bridgeSecret();
  if (!secret) {
    throw new Error("MCP OAuth bridge secret is not configured");
  }
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySignedPayload(value: string): string | null {
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
  return payload;
}

export function issueMcpIdentityCode(grant: McpIdentityGrant): string {
  const payload = Buffer.from(
    JSON.stringify({
      eu: grant.externalUserId,
      email: grant.email,
      state: grant.state,
      exp: Date.now() + IDENTITY_TTL_MS,
    }),
    "utf8"
  ).toString("base64url");
  return `${MCP_IDENTITY_CODE_PREFIX}${signPayload(payload)}`;
}

export function redeemMcpIdentityCode(code: string | undefined): McpIdentityGrant | null {
  const trimmed = code?.trim() ?? "";
  if (!trimmed.startsWith(MCP_IDENTITY_CODE_PREFIX)) return null;
  const signed = trimmed.slice(MCP_IDENTITY_CODE_PREFIX.length);
  const payload = verifySignedPayload(signed);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      eu?: unknown;
      email?: unknown;
      state?: unknown;
      exp?: unknown;
    };
    if (
      typeof parsed.eu !== "string" ||
      !parsed.eu ||
      parsed.eu.length > 256 ||
      typeof parsed.state !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    const email =
      typeof parsed.email === "string" && parsed.email.trim()
        ? parsed.email.trim()
        : undefined;
    return { externalUserId: parsed.eu, email, state: parsed.state };
  } catch {
    return null;
  }
}

export function resolveMcpMintSubject(body: {
  code?: unknown;
  externalUserId?: unknown;
  email?: unknown;
}):
  | { ok: true; externalUserId: string; email?: string }
  | { ok: false; status: 400 | 401; error: string; error_description: string } {
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return {
      ok: false,
      status: 400,
      error: "invalid_request",
      error_description: "code is required",
    };
  }
  const grant = redeemMcpIdentityCode(code);
  if (!grant) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      error_description: "invalid or expired code",
    };
  }
  const claimed =
    typeof body.externalUserId === "string" ? body.externalUserId.trim() : "";
  if (claimed && claimed !== grant.externalUserId) {
    return {
      ok: false,
      status: 400,
      error: "invalid_request",
      error_description: "externalUserId does not match code",
    };
  }
  const emailOverride =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim()
      : undefined;
  return {
    ok: true,
    externalUserId: grant.externalUserId,
    email: emailOverride ?? grant.email,
  };
}

export function buildMcpOauthCallbackUrl(input: {
  redirectUri: string;
  state: string;
  externalUserId: string;
  email?: string;
  code?: string;
}): string {
  const url = new URL(input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("external_user_id", input.externalUserId);
  if (input.code) {
    url.searchParams.set("code", input.code);
  }
  if (input.email) {
    url.searchParams.set("email", input.email);
  }
  return url.toString();
}

export const MCP_OAUTH_COMPLETE_PATH = "/api/v1/auth/mcp/complete";
