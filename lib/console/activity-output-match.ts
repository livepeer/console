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

function ticketKeys(ticket: SignedTicketRequestRow): string[] {
  return [ticket.gatewayRequestId.trim()].filter(Boolean);
}

function outputFromAsset(asset: MatchableAsset): JobOutput {
  return {
    url: asset.url,
    providerRequestId: asset.providerRequestId,
  };
}

/**
 * Map each OpenMeter ticket to a stored media URL.
 * Only the authenticated owner's exact `gateway_request_id` is authoritative.
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

  return out;
}
