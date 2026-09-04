import { parseClientId } from "./as";
import { normalizeRedirectUris } from "./dcr";

const CIMD_HOST = "chatgpt.com";
const CIMD_TIMEOUT_MS = 3000;
const CIMD_MAX_BYTES = 16_384;
const CIMD_CACHE_TTL_MS = 60_000;
const CIMD_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

export type OAuthClient = {
  redirectUris: string[];
};

export type ResolveClientResult =
  | { ok: true; client: OAuthClient }
  | { ok: false; error: "invalid_client" | "temporarily_unavailable" };

type CacheEntry = {
  exp: number;
  result: Exclude<ResolveClientResult, { error: "temporarily_unavailable" }>;
};

const cache = new Map<string, CacheEntry>();

export function clearCimdCache(): void {
  cache.clear();
}

/**
 * Codex / ChatGPT CIMD documents live on chatgpt.com:
 *   https://chatgpt.com/oauth/codex/client.json
 *   https://chatgpt.com/oauth/codex/<callback_id>/client.json
 *   https://chatgpt.com/oauth/<callback_id>/client.json
 */
export function isAllowedCimdClientId(clientId: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(clientId);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.hostname !== CIMD_HOST) return false;
  if (parsed.port) return false;
  if (parsed.search || parsed.hash) return false;
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return false;
  if (parts[0] !== "oauth") return false;
  if (parts.at(-1) !== "client.json") return false;
  const middle = parts.slice(1, -1);
  if (middle.length === 1) return CIMD_SEGMENT.test(middle[0] ?? "");
  return middle[0] === "codex" && CIMD_SEGMENT.test(middle[1] ?? "");
}

export function isKnownClientId(clientId: string): boolean {
  return parseClientId(clientId) !== null || isAllowedCimdClientId(clientId);
}

function supportsPublicClient(doc: Record<string, unknown>): boolean {
  const methods = doc.token_endpoint_auth_methods_supported;
  if (Array.isArray(methods)) {
    return methods.some((method) => String(method).toLowerCase() === "none");
  }
  const single = String(doc.token_endpoint_auth_method ?? "none").toLowerCase();
  return single === "none";
}

function parseCimdDocument(
  clientId: string,
  raw: unknown
): OAuthClient | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const doc = raw as Record<string, unknown>;
  if (typeof doc.client_id === "string" && doc.client_id !== clientId) {
    return null;
  }
  if (!supportsPublicClient(doc)) return null;
  const redirectUris = normalizeRedirectUris(doc.redirect_uris);
  if (!redirectUris) return null;
  return { redirectUris };
}

async function readLimitedJson(res: Response): Promise<object | null> {
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > CIMD_MAX_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(buf));
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function resolveCimdClient(
  clientId: string,
  fetchImpl: typeof fetch = fetch
): Promise<ResolveClientResult> {
  if (!isAllowedCimdClientId(clientId)) {
    return { ok: false, error: "invalid_client" };
  }

  const hit = cache.get(clientId);
  if (hit && hit.exp > Date.now()) return hit.result;

  let res: Response;
  try {
    res = await fetchImpl(clientId, {
      method: "GET",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(CIMD_TIMEOUT_MS)
    });
  } catch {
    return { ok: false, error: "temporarily_unavailable" };
  }

  if (res.status >= 500) {
    return { ok: false, error: "temporarily_unavailable" };
  }
  if (!res.ok) {
    const result: ResolveClientResult = { ok: false, error: "invalid_client" };
    cache.set(clientId, { exp: Date.now() + CIMD_CACHE_TTL_MS, result });
    return result;
  }

  const parsed = parseCimdDocument(clientId, await readLimitedJson(res));
  const result: ResolveClientResult = parsed
    ? { ok: true, client: parsed }
    : { ok: false, error: "invalid_client" };
  if (result.ok || result.error === "invalid_client") {
    cache.set(clientId, { exp: Date.now() + CIMD_CACHE_TTL_MS, result });
  }
  return result;
}

export async function resolveOAuthClient(
  clientId: string,
  fetchImpl: typeof fetch = fetch
): Promise<ResolveClientResult> {
  const dcr = parseClientId(clientId);
  if (dcr) return { ok: true, client: { redirectUris: dcr.redirectUris } };
  return resolveCimdClient(clientId, fetchImpl);
}
