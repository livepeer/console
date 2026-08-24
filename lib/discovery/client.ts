import { readDiscoveryServiceUrl } from "./config";
import { DEFAULT_DISCOVERY_SERVICE_TYPE, type DiscoveryServiceType } from "./constants";
import { mapCapabilityToModel } from "./map-to-model";
import type {
  DiscoveryCapabilitiesResponse,
  DiscoveryFreshnessResponse,
  DiscoveryQueryResponse,
  ExploreApiResponse,
} from "./types";

export { DEFAULT_DISCOVERY_SERVICE_TYPE, type DiscoveryServiceType } from "./constants";

async function discoveryFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = readDiscoveryServiceUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discovery Service ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchDiscoveryCapabilities(
  serviceType: DiscoveryServiceType = DEFAULT_DISCOVERY_SERVICE_TYPE,
): Promise<DiscoveryCapabilitiesResponse> {
  const params = new URLSearchParams({ serviceType });
  return discoveryFetch<DiscoveryCapabilitiesResponse>(
    `/v1/discovery/capabilities?${params}`,
  );
}

export async function fetchDiscoveryFreshness(): Promise<DiscoveryFreshnessResponse> {
  return discoveryFetch<DiscoveryFreshnessResponse>("/v1/discovery/freshness");
}

export async function queryDiscoveryCapabilities(
  capabilities: string[],
  serviceType: DiscoveryServiceType = DEFAULT_DISCOVERY_SERVICE_TYPE,
): Promise<DiscoveryQueryResponse> {
  if (capabilities.length === 0) {
    return { results: {} };
  }

  return discoveryFetch<DiscoveryQueryResponse>("/v1/discovery/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      capabilities,
      serviceTypes: [serviceType],
      topN: 50,
      sortBy: "avail",
    }),
  });
}

export async function fetchExploreModels(
  serviceType: DiscoveryServiceType = DEFAULT_DISCOVERY_SERVICE_TYPE,
): Promise<ExploreApiResponse> {
  const [capabilitiesResponse, freshness] = await Promise.all([
    fetchDiscoveryCapabilities(serviceType),
    fetchDiscoveryFreshness().catch(() => undefined),
  ]);

  const entries = capabilitiesResponse.entries ?? [];
  const capabilityNames =
    capabilitiesResponse.capabilities.length > 0
      ? capabilitiesResponse.capabilities
      : entries.map((entry) => entry.capability);

  const entryByCapability = new Map(entries.map((entry) => [entry.capability, entry]));

  const queryResponse = await queryDiscoveryCapabilities(capabilityNames, serviceType);

  const models = capabilityNames.map((capability) =>
    mapCapabilityToModel(
      capability,
      entryByCapability.get(capability),
      queryResponse.results[capability] ?? [],
    ),
  );

  models.sort((a, b) => {
    if (a.status !== b.status) return a.status === "hot" ? -1 : 1;
    return b.orchestrators - a.orchestrators;
  });

  return {
    models,
    capabilityCount: capabilityNames.length,
    serviceType,
    freshness,
  };
}
