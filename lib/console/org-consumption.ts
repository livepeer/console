import type { AccountUsagePayload } from "@/lib/console/pymthouse-bff";
import {
  humanizePipelineModel,
  microsToUsd,
} from "@/lib/console/usage-capability-display";
import { formatCompact, getOrgFleet } from "./org-fleet";

/**
 * The CONSUME (outbound) ledger — apps this organization calls, with MTD spend
 * and trailing 7-day call volume. Built from PymtHouse account-usage (OpenMeter).
 */

export interface ConsumedApp {
  /** App id when it's one of ours; otherwise pipeline|model key for linking. */
  id: string;
  name: string;
  /** Provider/owner label, or the org slug for apps you deployed. */
  owner: string;
  /** Did THIS organization deploy it? false = an app you didn't build. */
  owned: boolean;
  calls7d: number;
  /** Month-to-date spend in dollars. */
  spendNum: number;
}

export interface OrgConsumption {
  /** Apps you call, sorted by spend desc. The `owned` flag on each row tells
   *  your own apps apart from apps you didn't deploy. */
  apps: ConsumedApp[];
  totalCalls7d: number;
  totalSpendDisplay: string;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Last 7 UTC calendar dates (YYYY-MM-DD), newest first. */
function last7UtcDateKeys(now = new Date()): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    keys.add(d.toISOString().slice(0, 10));
  }
  return keys;
}

function ownerSlugFromPipeline(pipeline: string): string {
  const raw = pipeline.includes(":") ? pipeline.split(":").slice(-1)[0]! : pipeline;
  return raw.split(/[-_./|]+/).filter(Boolean)[0]?.toLowerCase() || pipeline.toLowerCase();
}

/**
 * Map a MTD account-usage payload into the Home Usage panel shape.
 * Spend is period totals (calendar MTD when fetched with `window=mtd`);
 * calls · 7d are summed from `dailyByPipeline` over the last 7 UTC days.
 */
export function buildOrgConsumptionFromUsage(
  payload: AccountUsagePayload,
  organization: string,
): OrgConsumption {
  const fleet = getOrgFleet();
  const ownedByPipelineId = new Map(
    fleet.apps.map((app) => [app.deployment.pipelineId, app.id] as const),
  );
  const last7 = last7UtcDateKeys();
  const periodDayCount = payload.periodDayKeys.length;

  const calls7dByKey = new Map<string, number>();
  for (const row of payload.current.dailyByPipeline) {
    if (!last7.has(row.date)) continue;
    const key = `${row.pipeline}|${row.modelId}`;
    calls7dByKey.set(key, (calls7dByKey.get(key) ?? 0) + row.requestCount);
  }

  const apps: ConsumedApp[] = payload.current.pipelineModels.map((row) => {
    const key = `${row.pipeline}|${row.modelId}`;
    const ownedAppId =
      ownedByPipelineId.get(row.pipeline) ?? ownedByPipelineId.get(row.modelId);
    const owned = Boolean(ownedAppId);
    const fromDaily = calls7dByKey.get(key) ?? 0;
    // Early in the month (or when daily buckets are missing) fall back to the
    // period total when the whole MTD window fits inside 7 days.
    const calls7d =
      fromDaily > 0 || periodDayCount > 7 ? fromDaily : row.requestCount;

    return {
      id: ownedAppId ?? key,
      name: humanizePipelineModel(row.pipeline, row.modelId),
      owner: owned ? organization.toLowerCase() : ownerSlugFromPipeline(row.pipeline),
      owned,
      calls7d,
      spendNum: microsToUsd(row.endUserBillableUsdMicros || row.networkFeeUsdMicros),
    };
  });

  apps.sort((a, b) => b.spendNum - a.spendNum || b.calls7d - a.calls7d);

  const totalSpendNum = microsToUsd(
    payload.current.endUserBillableUsdMicros || payload.current.networkFeeUsdMicros,
  );
  const totalCalls7d = apps.reduce((sum, app) => sum + app.calls7d, 0);

  return {
    apps,
    totalCalls7d,
    totalSpendDisplay: money(totalSpendNum),
  };
}

export { formatCompact };
