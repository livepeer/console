import type { SignedTicketRequestRow } from "@/lib/console/account-usage";

export type JobOutput = {
  url: string;
  providerRequestId?: string | null;
};

export type MatchableAsset = {
  id: string;
  url: string;
  capability: string;
  createdAt: string;
  gatewayRequestId: string;
  providerRequestId?: string | null;
};

/** Orchestrator Kafka events use RandomManifestID as CloudEvent id (~8 hex). */
export const TICKET_ASSET_MATCH_WINDOW_MS = 15 * 60 * 1000;

const ORCHESTRATOR_HEX_ID = /^[0-9a-f]{8}$/i;

export function isOrchestratorTicketId(id: string): boolean {
  return ORCHESTRATOR_HEX_ID.test(id.trim());
}

function ticketKeys(ticket: SignedTicketRequestRow): string[] {
  return [ticket.gatewayRequestId, ticket.eventId]
    .map((id) => id.trim())
    .filter((id, index, all) => id.length > 0 && all.indexOf(id) === index);
}

function outputFromAsset(asset: MatchableAsset): JobOutput {
  return {
    url: asset.url,
    providerRequestId: asset.providerRequestId,
  };
}

function needsFuzzyMatch(ticket: SignedTicketRequestRow): boolean {
  return ticketKeys(ticket).every(isOrchestratorTicketId);
}

/**
 * Map each OpenMeter ticket to a stored media URL.
 * Exact `gateway_request_id` / event id wins. Orchestrator 8-hex tickets
 * that never received an MCP `job_*` id may join the nearest same-capability
 * asset in the window — skipped when more than one candidate exists (race).
 */
export function matchTicketOutputs(
  tickets: SignedTicketRequestRow[],
  assets: MatchableAsset[]
): Map<string, JobOutput> {
  const byId = new Map<string, MatchableAsset>();
  for (const asset of assets) {
    const key = asset.gatewayRequestId.trim();
    if (key && !byId.has(key)) byId.set(key, asset);
  }

  const used = new Set<string>();
  const out = new Map<string, JobOutput>();

  for (const ticket of tickets) {
    const keys = ticketKeys(ticket);
    const exact = keys.map((key) => byId.get(key)).find(Boolean);
    if (exact) {
      used.add(exact.id);
      out.set(ticket.gatewayRequestId, outputFromAsset(exact));
    }
  }

  for (const ticket of tickets) {
    if (out.has(ticket.gatewayRequestId)) continue;
    if (!needsFuzzyMatch(ticket)) continue;
    const ticketTime = Date.parse(ticket.time);
    if (!Number.isFinite(ticketTime) || !ticket.modelId.trim()) continue;
    const candidates: Array<{ asset: MatchableAsset; delta: number }> = [];
    for (const asset of assets) {
      if (used.has(asset.id)) continue;
      if (asset.capability !== ticket.modelId) continue;
      const created = Date.parse(asset.createdAt);
      if (!Number.isFinite(created)) continue;
      const delta = Math.abs(created - ticketTime);
      if (delta > TICKET_ASSET_MATCH_WINDOW_MS) continue;
      candidates.push({ asset, delta });
    }
    if (candidates.length !== 1) continue;
    const hit = candidates[0]!;
    used.add(hit.asset.id);
    out.set(ticket.gatewayRequestId, outputFromAsset(hit.asset));
  }

  return out;
}
