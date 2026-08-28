import type { AccountUsagePipelineRow } from "@/lib/console/account-usage";

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

export function humanizePipelineModel(
  pipeline: string,
  modelId: string
): string {
  const normalizedModel =
    modelId && modelId !== "*" && modelId.toLowerCase() !== "unknown"
      ? modelId
      : "";
  const segment = normalizedModel || pipeline;
  const raw = segment.includes(":")
    ? segment.split(":").slice(-1)[0]!
    : segment;
  return raw
    .split(/[-_./|:]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function microsToUsd(micros: string): number {
  try {
    return Number(BigInt(micros)) / 1_000_000;
  } catch {
    return 0;
  }
}

/** UTC calendar dates (YYYY-MM-DD) from period start through end inclusive. */
export function utcDateKeysForPeriod(
  startIso: string,
  endIso: string
): string[] {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );
  const endDay = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );
  while (cursor <= endDay) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

export function dailyRequestSeriesForPipeline(input: {
  pipeline: string;
  modelId: string;
  dayKeys: string[];
  dailyByPipeline: Array<{
    pipeline: string;
    modelId: string;
    date: string;
    requestCount: number;
  }>;
}): number[] {
  const countsByDay = new Map<string, number>();
  const key = `${input.pipeline}|${input.modelId}`;
  for (const row of input.dailyByPipeline) {
    if (`${row.pipeline}|${row.modelId}` !== key) continue;
    countsByDay.set(
      row.date,
      (countsByDay.get(row.date) ?? 0) + row.requestCount
    );
  }
  return input.dayKeys.map((day) => countsByDay.get(day) ?? 0);
}

export function buildUsageCapabilityRows(input: {
  current: AccountUsagePipelineRow[];
  prior: AccountUsagePipelineRow[];
  period: { start: string; end: string };
  dailyByPipeline?: Array<{
    pipeline: string;
    modelId: string;
    date: string;
    requestCount: number;
  }>;
}): UsageCapabilityRow[] {
  const priorByKey = new Map(
    input.prior.map((row) => [`${row.pipeline}|${row.modelId}`, row])
  );
  const dayKeys = utcDateKeysForPeriod(input.period.start, input.period.end);

  return input.current
    .map((row, index) => {
      const key = `${row.pipeline}|${row.modelId}`;
      const priorRow = priorByKey.get(key);
      const priorSum = priorRow?.requestCount ?? 0;
      const delta =
        priorSum > 0
          ? ((row.requestCount - priorSum) / priorSum) * 100
          : row.requestCount > 0
            ? 100
            : 0;
      const spendUsd = microsToUsd(
        row.endUserBillableUsdMicros || row.networkFeeUsdMicros
      );
      const seriesSum = row.dailyRequests.reduce((a, b) => a + b, 0);
      const data =
        row.dailyRequests.length > 0 && seriesSum > 0
          ? row.dailyRequests
          : input.dailyByPipeline?.length && dayKeys.length > 0
            ? dailyRequestSeriesForPipeline({
                pipeline: row.pipeline,
                modelId: row.modelId,
                dayKeys,
                dailyByPipeline: input.dailyByPipeline,
              })
            : row.dailyRequests;
      return {
        ...row,
        id: key,
        name: humanizePipelineModel(row.pipeline, row.modelId),
        color: CAPABILITY_COLORS[index % CAPABILITY_COLORS.length]!,
        spendUsd,
        data,
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
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1, 0, 0, 0, 0)
    );
    return next.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "next period";
  }
}
