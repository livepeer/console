export type IncludedUsageSummary = {
  planName?: string;
  planId?: string;
  consumedUsdMicros: string;
  totalUsdMicros: string;
  remainingUsdMicros: string;
  remainingUsd?: string;
  totalUsd: string;
  resetsAt?: string;
};

export function includedUsageSummary(
  _billingState: unknown
): IncludedUsageSummary | null {
  return null;
}

export function includedUsageRemainingLabel(
  _included: IncludedUsageSummary | null
): string | null {
  return null;
}
