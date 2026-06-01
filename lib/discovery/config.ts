export function readDiscoveryServiceUrl(): string {
  const url = process.env.DISCOVERY_SERVICE_URL?.trim();
  if (!url) {
    throw new Error("DISCOVERY_SERVICE_URL is not configured");
  }
  return url.replace(/\/$/, "");
}
