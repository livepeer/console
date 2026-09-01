import type { McpPrincipal } from "./jwt";
import { resolveSignerSession } from "./signer-exchange";

export type CapabilityMode = "single-shot" | "persistent";

export type CapabilityRow = {
  name: string;
  mode: CapabilityMode;
  price?: unknown;
  runners: number;
  capacity_available: number;
};

type DiscoverRunner = {
  app?: unknown;
  mode?: unknown;
  price_info?: unknown;
  capacity_available?: unknown;
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
      const existing = byApp.get(app);
      if (!existing) {
        byApp.set(app, {
          mode,
          price: rec.price_info,
          runners: 1,
          capacity_available: capacityAvailable(rec.capacity_available)
        });
        continue;
      }
      existing.runners += 1;
      existing.capacity_available += capacityAvailable(rec.capacity_available);
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
      capacity_available: row.capacity_available
    }));
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
): Promise<CapabilityRow | null> {
  return findCapability(await listNetworkCapabilities(principal), name);
}
