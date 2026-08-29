/**
 * Livepeer discovery-service URL.
 *
 * Configure the full raw endpoint, e.g.
 * `https://discovery-service-production-8955.up.railway.app/v1/discovery/raw`
 * Tokens embed that value as-is. Explore uses the URL origin for sibling
 * `/v1/discovery/…` routes.
 */

const ENV_KEYS = [
  "DISCOVERY_URL",
  "DISCOVERY_SERVICE_URL",
  "LIVEPEER_DISCOVERY_SERVICE_URL",
] as const;

function readConfiguredDiscoveryUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  for (const key of ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Full raw endpoint for python-gateway `--token` (as configured). */
export function readDiscoveryRawUrl(): string | undefined {
  return readConfiguredDiscoveryUrl();
}

/**
 * Origin for Explore catalog fetches (`/v1/discovery/capabilities`, etc.).
 * Env must be an absolute URL to the raw discovery endpoint.
 */
export function readDiscoveryServiceUrl(): string {
  const configured = readConfiguredDiscoveryUrl();
  if (!configured) {
    throw new Error(
      "DISCOVERY_SERVICE_URL (or DISCOVERY_URL) is not configured",
    );
  }
  return new URL(configured).origin;
}
