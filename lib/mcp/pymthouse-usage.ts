import { microsToUsd } from "@/lib/console/usage-capability-display";

export type PymthouseUsageSnapshot = {
  period: { start: string; end: string };
  requestCount: number;
  networkFeeUsdMicros: string;
  spentUsd: number;
  remainingIncludedUsd: number;
  hasAccess: boolean;
  source: "pymthouse";
};

export function usageSnapshotFromPayload(payload: {
  period: { start: string; end: string };
  current: { requestCount: number; networkFeeUsdMicros: string };
  balance: { balanceUsdMicros: string; hasAccess: boolean } | null;
}): PymthouseUsageSnapshot {
  const remainingMicros = payload.balance?.balanceUsdMicros ?? "0";
  return {
    period: payload.period,
    requestCount: payload.current.requestCount,
    networkFeeUsdMicros: payload.current.networkFeeUsdMicros,
    spentUsd: microsToUsd(payload.current.networkFeeUsdMicros),
    remainingIncludedUsd: microsToUsd(remainingMicros),
    hasAccess: payload.balance?.hasAccess ?? false,
    source: "pymthouse",
  };
}

export function assertSpendable(usage: PymthouseUsageSnapshot): void {
  if (!usage.hasAccess) {
    throw new Error(
      "PymtHouse spendable is exhausted. Add funds or wait for included usage to reset."
    );
  }
}
