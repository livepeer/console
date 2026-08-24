import { RunnerGatewayError } from "@/lib/runner-gateway/errors";

export type LiveRunnerInstance = {
  url: string;
  app: string;
  runnerId: string;
  mode: string;
  orchestratorUrl: string;
  raw: Record<string, unknown>;
};

type DiscoveryEntry = Record<string, unknown>;

function normalizeFilterValues(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => item.trim()).filter(Boolean);
}

function appendQueryValues(
  url: string,
  pairs: Array<[string, string]>
): string {
  if (pairs.length === 0) return url;
  const parsed = new URL(url);
  for (const [key, val] of pairs) {
    parsed.searchParams.append(key, val);
  }
  return parsed.toString();
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function runnerCandidatesFromDiscovery(
  entries: DiscoveryEntry[]
): LiveRunnerInstance[] {
  const candidates: LiveRunnerInstance[] = [];
  for (const entry of entries) {
    const orchestratorUrl = stringValue(entry.address);
    const runners = entry.runners;
    if (!Array.isArray(runners)) continue;

    for (const runner of runners) {
      if (!runner || typeof runner !== "object") continue;
      const record = runner as Record<string, unknown>;
      const url = stringValue(record.url);
      const app = stringValue(record.app);
      if (!url || !app) continue;
      candidates.push({
        url,
        app,
        runnerId: stringValue(record.runner_id),
        mode: stringValue(record.mode),
        orchestratorUrl,
        raw: record,
      });
    }
  }
  return candidates;
}

export async function discoverRunners(input: {
  discoveryUrl: string;
  app?: string | string[];
  gpu?: string | string[];
  headers?: Record<string, string>;
}): Promise<DiscoveryEntry[]> {
  const appFilters = normalizeFilterValues(input.app);
  const gpuFilters = normalizeFilterValues(input.gpu);

  let endpoint = input.discoveryUrl.trim();
  const queryPairs: Array<[string, string]> = [];
  for (const item of appFilters) queryPairs.push(["app", item]);
  for (const item of gpuFilters) queryPairs.push(["gpu", item]);
  endpoint = appendQueryValues(endpoint, queryPairs);

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...input.headers,
    },
    cache: "no-store",
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new RunnerGatewayError(
      `Discovery failed: HTTP ${response.status}${bodyText ? ` — ${bodyText.slice(0, 200)}` : ""}`,
      { code: "discovery_failed", status: 502 }
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new RunnerGatewayError("Discovery response was not valid JSON", {
      code: "discovery_failed",
      status: 502,
    });
  }

  if (!Array.isArray(data)) {
    throw new RunnerGatewayError(
      `Discovery response must be a JSON list, got ${typeof data}`,
      { code: "discovery_failed", status: 502 }
    );
  }

  return data.filter(
    (entry): entry is DiscoveryEntry =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
  );
}

export async function discoverRunnerCandidates(input: {
  discoveryUrl: string;
  app?: string | string[];
  gpu?: string | string[];
  headers?: Record<string, string>;
}): Promise<LiveRunnerInstance[]> {
  const entries = await discoverRunners(input);
  return runnerCandidatesFromDiscovery(entries);
}
