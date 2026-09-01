import { fetchAccountUsageForExternalUser } from "@/lib/console/pymthouse-bff";
import { microsToUsd } from "@/lib/console/usage-capability-display";
import type { McpPrincipal } from "@/lib/mcp/jwt";

export type PymthouseUsageSnapshot = {
  period: { start: string; end: string };
  requestCount: number;
  networkFeeUsdMicros: string;
  spentUsd: number;
  remainingIncludedUsd: number;
  hasAccess: boolean;
};

const CACHE_TTL_MS = 8_000;
const cache = new Map<string, { at: number; data: PymthouseUsageSnapshot }>();

export async function fetchMcpUsage(
  principal: McpPrincipal
): Promise<PymthouseUsageSnapshot> {
  const cacheKey = principal.externalUserId;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const payload = await fetchAccountUsageForExternalUser({
    externalUserId: principal.externalUserId,
    periodDays: 1,
    window: "rolling",
    includePrior: false,
  });

  const remainingMicros = payload.balance?.balanceUsdMicros ?? "0";
  const data: PymthouseUsageSnapshot = {
    period: payload.period,
    requestCount: payload.current.requestCount,
    networkFeeUsdMicros: payload.current.networkFeeUsdMicros,
    spentUsd: microsToUsd(payload.current.networkFeeUsdMicros),
    remainingIncludedUsd: microsToUsd(remainingMicros),
    hasAccess: payload.balance ? payload.balance.hasAccess : true,
  };
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}
