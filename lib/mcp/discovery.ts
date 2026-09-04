import type { McpPrincipal } from "./jwt";
import { lookupFalCapability } from "./fal-capability-catalog";
import { resolveSignerSession } from "./signer-exchange";

export type CapabilityMode = "single-shot" | "persistent";

export type CapabilityRow = {
  name: string;
  mode: CapabilityMode;
  price?: unknown;
  runners: number;
  capacity_available: number;
  endpoint_id?: string | null;
  provider?: string | null;
  schema_sha256?: string | null;
  transport?: string | null;
};

export type CapabilityDetail = CapabilityRow & {
  catalog?: {
    label: string;
    endpoint_id: string;
    provider: string;
    schema_sha256: string;
    transport: string;
    price_usd: number | null;
  } | null;
  inputs_hint?: string;
};

type DiscoverRunner = {
  app?: unknown;
  mode?: unknown;
  price_info?: unknown;
  capacity_available?: unknown;
  metadata?: unknown;
};

type DiscoverOrch = {
  runners?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeMode(mode: unknown): CapabilityMode {
  const n = typeof mode === "string" ? mode.replaceAll("_", "-").trim() : "";
  if (!n || n === "single-shot") {
    return "single-shot";
  }
  return "persistent";
}

function capacityAvailable(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseRunnerMetadata(value: unknown): {
  endpoint_id: string | null;
  provider: string | null;
  schema_sha256: string | null;
  transport: string | null;
} {
  if (typeof value !== "string" || !value.trim()) {
    return {
      endpoint_id: null,
      provider: null,
      schema_sha256: null,
      transport: null
    };
  }
  try {
    const meta = JSON.parse(value) as Record<string, unknown>;
    return {
      endpoint_id: typeof meta.endpoint_id === "string" ? meta.endpoint_id : null,
      provider: typeof meta.provider === "string" ? meta.provider : null,
      schema_sha256: typeof meta.schema_sha256 === "string" ? meta.schema_sha256 : null,
      transport: typeof meta.transport === "string" ? meta.transport : null
    };
  } catch {
    return {
      endpoint_id: null,
      provider: null,
      schema_sha256: null,
      transport: null
    };
  }
}

function mergeMetadata(
  existing: {
    endpoint_id: string | null;
    provider: string | null;
    schema_sha256: string | null;
    transport: string | null;
  },
  next: {
    endpoint_id: string | null;
    provider: string | null;
    schema_sha256: string | null;
    transport: string | null;
  }
) {
  return {
    endpoint_id: existing.endpoint_id ?? next.endpoint_id,
    provider: existing.provider ?? next.provider,
    schema_sha256: existing.schema_sha256 ?? next.schema_sha256,
    transport: existing.transport ?? next.transport
  };
}

/**
 * Aggregate runner apps from a signer discover-orchestrators payload.
 * Orch rows with only capabilities[] (no runners) are ignored.
 */
export function catalogFromDiscoverOrchestrators(raw: unknown): CapabilityRow[] {
  if (!Array.isArray(raw)) {
    throw new TypeError("Discovery response must be a JSON list");
  }

  const byApp = new Map<
    string,
    {
      mode: CapabilityMode;
      price: unknown;
      runners: number;
      capacity_available: number;
      endpoint_id: string | null;
      provider: string | null;
      schema_sha256: string | null;
      transport: string | null;
    }
  >();

  for (const item of raw) {
    const orch = asRecord(item) as DiscoverOrch | null;
    if (!orch || !Array.isArray(orch.runners)) {
      continue;
    }
    for (const runner of orch.runners) {
      const rec = asRecord(runner) as DiscoverRunner | null;
      if (!rec) {
        continue;
      }
      const app = typeof rec.app === "string" ? rec.app.trim() : "";
      if (!app) {
        continue;
      }
      const mode = normalizeMode(rec.mode);
      const metadata = parseRunnerMetadata(rec.metadata);
      const existing = byApp.get(app);
      if (!existing) {
        byApp.set(app, {
          mode,
          price: rec.price_info,
          runners: 1,
          capacity_available: capacityAvailable(rec.capacity_available),
          ...metadata
        });
        continue;
      }
      existing.runners += 1;
      existing.capacity_available += capacityAvailable(rec.capacity_available);
      const merged = mergeMetadata(
        {
          endpoint_id: existing.endpoint_id,
          provider: existing.provider,
          schema_sha256: existing.schema_sha256,
          transport: existing.transport
        },
        metadata
      );
      existing.endpoint_id = merged.endpoint_id;
      existing.provider = merged.provider;
      existing.schema_sha256 = merged.schema_sha256;
      existing.transport = merged.transport;
      if (mode === "single-shot") {
        existing.mode = "single-shot";
        if (existing.price == null) {
          existing.price = rec.price_info;
        }
      }
    }
  }

  return [...byApp.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, row]) => ({
      name,
      mode: row.mode,
      price: row.price ?? null,
      runners: row.runners,
      capacity_available: row.capacity_available,
      endpoint_id: row.endpoint_id,
      provider: row.provider,
      schema_sha256: row.schema_sha256,
      transport: row.transport
    }));
}

export function enrichCapabilityDetail(row: CapabilityRow): CapabilityDetail {
  const catalog = lookupFalCapability(row.name);
  const endpointId = row.endpoint_id ?? catalog?.endpointId ?? null;
  const provider = row.provider ?? catalog?.provider ?? null;
  const schemaSha = row.schema_sha256 ?? catalog?.schemaSha256 ?? null;
  const transport = row.transport ?? catalog?.transport ?? null;
  const inputsHint =
    row.mode === "persistent"
      ? "Persistent apps require `endpoint` (app path, e.g. /hello) on run_capability."
      : endpointId
        ? `Single-shot fal route. Pass inputs for ${endpointId} in run_capability.inputs (e.g. prompt, image_url).`
        : "Single-shot. Pass the runner's input fields in run_capability.inputs.";

  return {
    ...row,
    endpoint_id: endpointId,
    provider,
    schema_sha256: schemaSha,
    transport,
    catalog: catalog
      ? {
          label: catalog.label,
          endpoint_id: catalog.endpointId,
          provider: catalog.provider,
          schema_sha256: catalog.schemaSha256,
          transport: catalog.transport,
          price_usd: catalog.priceUsd
        }
      : null,
    inputs_hint: inputsHint
  };
}

export function findCapability(
  rows: CapabilityRow[],
  name: string
): CapabilityRow | null {
  const needle = name.trim().toLowerCase();
  if (!needle) {
    return null;
  }
  return rows.find((c) => c.name.toLowerCase() === needle) ?? null;
}

export async function listNetworkCapabilities(
  principal: McpPrincipal
): Promise<CapabilityRow[]> {
  const session = await resolveSignerSession(principal);
  const res = await fetch(session.discovery_url, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`discovery capabilities failed (${res.status})`);
  }
  return catalogFromDiscoverOrchestrators(await res.json());
}

export async function describeNetworkCapability(
  principal: McpPrincipal,
  name: string
): Promise<CapabilityDetail | null> {
  const row = findCapability(await listNetworkCapabilities(principal), name);
  return row ? enrichCapabilityDetail(row) : null;
}
