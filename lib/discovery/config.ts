/**
 * Canonical Livepeer discovery-service URL helpers.
 *
 * Accepts either env name and either URL shape:
 * - origin/base: `https://discovery-service…up.railway.app`
 * - raw endpoint: `https://…/v1/discovery/raw` (optional query)
 *
 * Explore uses the base and appends `/v1/discovery/…`.
 * Gateway `--token` embeds the raw endpoint as-is.
 */

export const DISCOVERY_RAW_PATH = "/v1/discovery/raw";

const ENV_KEYS = [
  "DISCOVERY_URL",
  "DISCOVERY_SERVICE_URL",
  "LIVEPEER_DISCOVERY_SERVICE_URL",
] as const;

/** First non-empty configured discovery URL (any accepted shape). */
export function readConfiguredDiscoveryUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  for (const key of ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * Normalize to discovery-service origin (no `/v1/discovery…`, no query/hash).
 */
export function normalizeDiscoveryServiceBaseUrl(input: string): string {
  const url = new URL(input.trim());
  const discoveryIdx = url.pathname.indexOf("/v1/discovery");
  if (discoveryIdx >= 0) {
    url.pathname = url.pathname.slice(0, discoveryIdx) || "/";
  }
  url.search = "";
  url.hash = "";
  const path = url.pathname.replace(/\/+$/, "");
  return path && path !== "/" ? `${url.origin}${path}` : url.origin;
}

/**
 * Full GET endpoint for orchestrator lists (python-gateway tokens).
 * Preserves query string when the configured URL already targeted raw.
 */
export function resolveDiscoveryRawUrl(input: string): string {
  const trimmed = input.trim();
  const parsed = new URL(trimmed);
  const base = normalizeDiscoveryServiceBaseUrl(trimmed);
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  const search =
    path === DISCOVERY_RAW_PATH || path.endsWith(DISCOVERY_RAW_PATH)
      ? parsed.search
      : "";
  return `${base}${DISCOVERY_RAW_PATH}${search}`;
}

/** Base URL for Explore (`/v1/discovery/capabilities`, etc.). Required. */
export function readDiscoveryServiceUrl(): string {
  const configured = readConfiguredDiscoveryUrl();
  if (!configured) {
    throw new Error(
      "DISCOVERY_SERVICE_URL (or DISCOVERY_URL) is not configured",
    );
  }
  return normalizeDiscoveryServiceBaseUrl(configured);
}

/** Raw discovery endpoint for python-gateway `--token` bundles. Optional. */
export function readDiscoveryRawUrl(): string | undefined {
  const configured = readConfiguredDiscoveryUrl();
  return configured ? resolveDiscoveryRawUrl(configured) : undefined;
}
