import type { AccountUsagePipelineRow } from "@/lib/dashboard/pymthouse-bff";

const CAPABILITY_COLORS = [
  "#4ade80",
  "#38bdf8",
  "#a78bfa",
  "#fb923c",
  "#f472b6",
  "#facc15",
  "#2dd4bf",
  "#818cf8",
];

export type UsageCapabilityRow = AccountUsagePipelineRow & {
  id: string;
  name: string;
  color: string;
  spendUsd: number;
  data: number[];
  priorSum: number;
  delta: number;
};

function humanizePipelineModel(pipeline: string, modelId: string): string {
  const segment = modelId && modelId !== "*" ? modelId : pipeline;
  const raw = segment.includes(":") ? segment.split(":").slice(-1)[0]! : segment;
  return raw
    .split(/[-_./|:]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function microsToUsd(micros: string): number {
  try {
    return Number(BigInt(micros)) / 1_000_000;
  } catch {
    return 0;
  }
}

function distributeDaily(total: number, days: number): number[] {
  if (days <= 0) return [];
  if (total <= 0) return Array.from({ length: days }, () => 0);
  const base = Math.floor(total / days);
  const remainder = total % days;
  return Array.from({ length: days }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function buildUsageCapabilityRows(input: {
  current: AccountUsagePipelineRow[];
  prior: AccountUsagePipelineRow[];
  periodDays: number;
}): UsageCapabilityRow[] {
  const priorByKey = new Map(
    input.prior.map((row) => [`${row.pipeline}|${row.modelId}`, row]),
  );

  return input.current
    .map((row, index) => {
      const key = `${row.pipeline}|${row.modelId}`;
      const priorRow = priorByKey.get(key);
      const priorSum = priorRow?.requestCount ?? 0;
      const delta =
        priorSum > 0 ? ((row.requestCount - priorSum) / priorSum) * 100 : row.requestCount > 0 ? 100 : 0;
      const spendUsd = microsToUsd(row.endUserBillableUsdMicros || row.networkFeeUsdMicros);
      return {
        ...row,
        id: key,
        name: humanizePipelineModel(row.pipeline, row.modelId),
        color: CAPABILITY_COLORS[index % CAPABILITY_COLORS.length]!,
        spendUsd,
        data: distributeDaily(row.requestCount, input.periodDays),
        priorSum,
        delta,
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount);
}

export function microsToUsdDisplay(micros: string): string {
  const usd = microsToUsd(micros);
  if (usd >= 100) return usd.toFixed(2);
  if (usd >= 1) return usd.toFixed(2);
  if (usd >= 0.01) return usd.toFixed(3);
  return usd.toFixed(4);
}

export function formatPeriodResetLabel(periodEndIso: string): string {
  try {
    const end = new Date(periodEndIso);
    const next = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    );
    return next.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "next period";
  }
}
