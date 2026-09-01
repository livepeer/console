import { defaultSpendCapUsd } from "./env";
import type { PymthouseUsageSnapshot } from "./pymthouse-spend";

export type SpendReport = {
  capUsd: number;
  spentUsd: number;
  count: number;
  networkFeeUsdMicros: string;
  period: { start: string; end: string };
  remainingIncludedUsd: number;
  hasAccess: boolean;
  source: "pymthouse";
};

const capByPrincipal = new Map<string, number>();

function capUsdFor(principalId: string): number {
  return capByPrincipal.get(principalId) ?? defaultSpendCapUsd();
}

export function mergeSpendReport(
  principalId: string,
  usage: PymthouseUsageSnapshot
): SpendReport {
  return {
    capUsd: capUsdFor(principalId),
    spentUsd: usage.spentUsd,
    count: usage.requestCount,
    networkFeeUsdMicros: usage.networkFeeUsdMicros,
    period: usage.period,
    remainingIncludedUsd: usage.remainingIncludedUsd,
    hasAccess: usage.hasAccess,
    source: "pymthouse",
  };
}

export function setSpendCap(principalId: string, capUsd: number): number {
  const max = defaultSpendCapUsd();
  if (capUsd > max) {
    throw new Error(`cap_usd cannot exceed campaign max $${max}`);
  }
  capByPrincipal.set(principalId, capUsd);
  return capUsd;
}

export function resetSpendCap(principalId: string): number {
  capByPrincipal.delete(principalId);
  return defaultSpendCapUsd();
}

export function assertSpendHeadroom(report: SpendReport): void {
  if (!report.hasAccess) {
    throw new Error(
      "PymtHouse spendable is exhausted. Add funds or wait for included usage to reset."
    );
  }
  if (report.spentUsd >= report.capUsd) {
    throw new Error(
      `spend_cap exceeded: $${report.spentUsd.toFixed(4)} spent of $${report.capUsd} cap`
    );
  }
}
