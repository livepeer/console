import { fetchAccountUsageForExternalUser } from "@/lib/console/pymthouse-bff";
import type { McpPrincipal } from "@/lib/mcp/jwt";
import {
  usageSnapshotFromPayload,
  type PymthouseUsageSnapshot,
} from "@/lib/mcp/pymthouse-usage";

export type { PymthouseUsageSnapshot };

export async function fetchMcpUsage(
  principal: McpPrincipal
): Promise<PymthouseUsageSnapshot> {
  // rolling + 1 day is today 00:00–23:59 UTC (BFF calendar window, not last 24h).
  const payload = await fetchAccountUsageForExternalUser({
    externalUserId: principal.externalUserId,
    periodDays: 1,
    window: "rolling",
    includePrior: false,
  });
  return usageSnapshotFromPayload(payload);
}
