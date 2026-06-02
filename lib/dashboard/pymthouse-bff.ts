import { PmtHouseError } from "@pymthouse/builder-sdk";
import { createPmtHouseClientForPublicApp } from "@/lib/dashboard/device-flow";
import {
  dailyRequestSeriesForPipeline,
  utcDateKeysForPeriod,
} from "@/lib/dashboard/usage-capability-display";

export type AccountUsageBalance = {
  externalUserId: string;
  balanceUsdMicros: string;
  consumedUsdMicros: string;
  lifetimeGrantedUsdMicros: string;
  hasAccess: boolean;
};

export type AccountUsageDailyPipelineRow = {
  pipeline: string;
  modelId: string;
  date: string;
  requestCount: number;
  networkFeeUsdMicros: string;
};

export type AccountUsagePipelineRow = {
  pipeline: string;
  modelId: string;
  requestCount: number;
  networkFeeUsdMicros: string;
  endUserBillableUsdMicros: string;
  /** OpenMeter daily buckets aligned to `period` (oldest → newest). */
  dailyRequests: number[];
};

export type AccountUsagePayload = {
  clientId: string;
  period: { start: string; end: string };
  /** UTC YYYY-MM-DD keys aligned with `pipelineModels[].dailyRequests` (oldest → newest). */
  periodDayKeys: string[];
  priorPeriod: { start: string; end: string };
  balance: AccountUsageBalance | null;
  current: {
    requestCount: number;
    networkFeeUsdMicros: string;
    endUserBillableUsdMicros: string;
    pipelineModels: AccountUsagePipelineRow[];
    dailyByPipeline: AccountUsageDailyPipelineRow[];
  };
  prior: {
    requestCount: number;
    pipelineModels: AccountUsagePipelineRow[];
  };
};

function readPublicClientId(): string {
  const id =
    process.env.PYMTHOUSE_PUBLIC_CLIENT_ID?.trim() ||
    process.env.DASHBOARD_DEVICE_PUBLIC_CLIENT_ID?.trim();
  if (!id) {
    throw new PmtHouseError(
      "PYMTHOUSE_PUBLIC_CLIENT_ID (or DASHBOARD_DEVICE_PUBLIC_CLIENT_ID) is required",
      { status: 503, code: "pymthouse_required" },
    );
  }
  return id;
}

function rollingPeriodDays(days: number, now = new Date()): {
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
} {
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  const priorEnd = new Date(start);
  priorEnd.setUTCMilliseconds(priorEnd.getUTCMilliseconds() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setUTCDate(priorStart.getUTCDate() - (days - 1));
  priorStart.setUTCHours(0, 0, 0, 0);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    priorStartDate: priorStart.toISOString(),
    priorEndDate: priorEnd.toISOString(),
  };
}

async function fetchUsageBalance(
  publicClientId: string,
  externalUserId: string,
): Promise<AccountUsageBalance | null> {
  const issuerUrl = process.env.PYMTHOUSE_ISSUER_URL?.trim();
  if (!issuerUrl) {
    return null;
  }
  const appsOrigin = issuerUrl.replace(/\/api\/v1\/oidc\/?$/i, "");
  const url = new URL(
    `${appsOrigin}/api/v1/apps/${encodeURIComponent(publicClientId)}/usage/balance`,
  );
  url.searchParams.set("externalUserId", externalUserId);

  const m2mId = process.env.PYMTHOUSE_M2M_CLIENT_ID?.trim();
  const m2mSecret = process.env.PYMTHOUSE_M2M_CLIENT_SECRET?.trim();
  if (!m2mId || !m2mSecret) {
    return null;
  }

  const basic = Buffer.from(`${m2mId}:${m2mSecret}`).toString("base64");
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as {
    externalUserId?: string;
    balanceUsdMicros?: string;
    consumedUsdMicros?: string;
    lifetimeGrantedUsdMicros?: string;
    hasAccess?: boolean;
  };

  return {
    externalUserId: body.externalUserId ?? externalUserId,
    balanceUsdMicros: body.balanceUsdMicros ?? "0",
    consumedUsdMicros: body.consumedUsdMicros ?? "0",
    lifetimeGrantedUsdMicros: body.lifetimeGrantedUsdMicros ?? "0",
    hasAccess: Boolean(body.hasAccess),
  };
}

export async function fetchAccountUsageForExternalUser(input: {
  externalUserId: string;
  periodDays?: number;
}): Promise<AccountUsagePayload> {
  const publicClientId = readPublicClientId();
  const days = input.periodDays ?? 30;
  // Rolling window so the chart's last bucket is always UTC today (not month-end).
  const period = rollingPeriodDays(days);

  const client = createPmtHouseClientForPublicApp(publicClientId);

  const [balance, currentScope, priorScope] = await Promise.all([
    fetchUsageBalance(publicClientId, input.externalUserId),
    client.fetchUsageForExternalUser({
      externalUserId: input.externalUserId,
      startDate: period.startDate,
      endDate: period.endDate,
    }),
    client.fetchUsageForExternalUser({
      externalUserId: input.externalUserId,
      startDate: period.priorStartDate,
      endDate: period.priorEndDate,
    }),
  ]);

  const periodBounds = { start: period.startDate, end: period.endDate };
  const dayKeys = utcDateKeysForPeriod(periodBounds.start, periodBounds.end);
  const dailyByPipeline = (currentScope.currentUser.dailyByPipeline ?? []).map((row) => ({
    pipeline: row.pipeline,
    modelId: row.modelId,
    date: row.date,
    requestCount: row.requestCount,
    networkFeeUsdMicros: row.networkFeeUsdMicros,
  }));

  const mapPipeline = (
    rows: typeof currentScope.currentUser.pipelineModels,
  ): AccountUsagePipelineRow[] =>
    rows.map((row) => ({
      pipeline: row.pipeline,
      modelId: row.modelId,
      requestCount: row.requestCount,
      networkFeeUsdMicros: row.networkFeeUsdMicros,
      endUserBillableUsdMicros: row.endUserBillableUsdMicros,
      dailyRequests: dailyRequestSeriesForPipeline({
        pipeline: row.pipeline,
        modelId: row.modelId,
        dayKeys,
        dailyByPipeline,
      }),
    }));

  return {
    clientId: currentScope.clientId,
    period: periodBounds,
    periodDayKeys: dayKeys,
    priorPeriod: { start: period.priorStartDate, end: period.priorEndDate },
    balance,
    current: {
      requestCount: currentScope.currentUser.requestCount,
      networkFeeUsdMicros: currentScope.currentUser.networkFeeUsdMicros,
      endUserBillableUsdMicros: currentScope.currentUser.endUserBillableUsdMicros,
      pipelineModels: mapPipeline(currentScope.currentUser.pipelineModels),
      dailyByPipeline,
    },
    prior: {
      requestCount: priorScope.currentUser.requestCount,
      pipelineModels: mapPipeline(
        priorScope.currentUser.pipelineModels,
      ).map((row) => ({
        ...row,
        dailyRequests: dailyRequestSeriesForPipeline({
          pipeline: row.pipeline,
          modelId: row.modelId,
          dayKeys: utcDateKeysForPeriod(period.priorStartDate, period.priorEndDate),
          dailyByPipeline: [],
        }),
      })),
    },
  };
}
