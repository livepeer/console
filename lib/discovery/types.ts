/** Discovery Service API shapes (see discovery-service openapi). */

export interface DiscoveryCapabilityEntry {
  serviceType: string;
  capability: string;
  offeringIds?: string[];
}

export interface DiscoveryCapabilitiesResponse {
  capabilities: string[];
  entries?: DiscoveryCapabilityEntry[];
}

export interface DiscoveryDatasetRow {
  serviceType?: string;
  ethAddress?: string;
  offeringId?: string;
  interactionMode?: string;
  workUnit?: string;
  pricePerUnitWei?: string;
  orchUri: string;
  gpuName?: string;
  gpuGb?: number;
  avail: number;
  totalCap: number;
  pricePerUnit: number;
  bestLatMs?: number | null;
  avgLatMs?: number | null;
  swapRatio?: number | null;
  avgAvail?: number | null;
  score?: number;
  slaScore?: number | null;
}

export interface DiscoveryQueryResponse {
  results: Record<string, DiscoveryDatasetRow[]>;
  datasetVersion?: number;
  queryTimeMs?: number;
}

export interface DiscoveryFreshnessResponse {
  populated?: boolean;
  refreshedAt?: number;
  ageMs?: number;
  capabilityCount?: number;
  totalRows?: number;
}

export interface ExploreApiResponse {
  models: import("@/lib/dashboard/types").App[];
  capabilityCount: number;
  serviceType: string;
  freshness?: DiscoveryFreshnessResponse;
}
