import {
  getUtcCalendarMonthIsoBounds,
  PmtHouseClient,
  PmtHouseError,
} from "@pymthouse/builder-sdk";
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

function readPymthouseM2mConfig() {
  const issuerUrl = process.env.PYMTHOUSE_ISSUER_URL?.trim();
  const m2mClientId = process.env.PYMTHOUSE_M2M_CLIENT_ID?.trim();
  const m2mClientSecret = process.env.PYMTHOUSE_M2M_CLIENT_SECRET?.trim();
  if (!issuerUrl || !m2mClientId || !m2mClientSecret) {
    return null;
  }
  return {
    issuerUrl,
    m2mClientId,
    m2mClientSecret,
    allowInsecureHttp: process.env.PYMTHOUSE_ALLOW_INSECURE_HTTP === "1",
  };
}

export function createPmtHouseClientForPublicApp(publicClientId: string): PmtHouseClient {
  const config = readPymthouseM2mConfig();
  if (!config) {
    throw new PmtHouseError(
      "Pymthouse is not configured. Set PYMTHOUSE_ISSUER_URL, PYMTHOUSE_M2M_CLIENT_ID, and PYMTHOUSE_M2M_CLIENT_SECRET.",
      { status: 503, code: "pymthouse_required" },
    );
  }
  return new PmtHouseClient({
    issuerUrl: config.issuerUrl,
    publicClientId,
    m2mClientId: config.m2mClientId,
    m2mClientSecret: config.m2mClientSecret,
    allowInsecureHttp: config.allowInsecureHttp,
  });
}

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

function mtdPeriodBounds(now = new Date()): {
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
} {
  const { startDate, endDate } = getUtcCalendarMonthIsoBounds(now);
  const monthStart = new Date(startDate);
  const priorEnd = new Date(monthStart.getTime() - 1);
  const priorStart = new Date(
    Date.UTC(priorEnd.getUTCFullYear(), priorEnd.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  return {
    startDate,
    endDate,
    priorStartDate: priorStart.toISOString(),
    priorEndDate: priorEnd.toISOString(),
  };
}

async function fetchUsageBalance(
  client: PmtHouseClient,
  externalUserId: string,
): Promise<AccountUsageBalance | null> {
  try {
    const balance = await client.getUsageBalance(externalUserId);
    return {
      externalUserId: balance.externalUserId ?? externalUserId,
      balanceUsdMicros: balance.balanceUsdMicros ?? "0",
      consumedUsdMicros: balance.consumedUsdMicros ?? "0",
      lifetimeGrantedUsdMicros: balance.lifetimeGrantedUsdMicros ?? "0",
      hasAccess: Boolean(balance.hasAccess),
    };
  } catch {
    // Balance is best-effort — usage still renders without the allowance strip.
    return null;
  }
}

export async function fetchAccountUsageForExternalUser(input: {
  externalUserId: string;
  periodDays?: number;
  /** `mtd` = UTC calendar month (Home spend · MTD). Default rolling N days. */
  window?: "rolling" | "mtd";
  /** When false, skip the prior-period OpenMeter round-trip (Home panel). */
  includePrior?: boolean;
}): Promise<AccountUsagePayload> {
  const publicClientId = readPublicClientId();
  const includePrior = input.includePrior !== false;
  const period =
    input.window === "mtd"
      ? mtdPeriodBounds()
      : rollingPeriodDays(input.periodDays ?? 30);

  const client = createPmtHouseClientForPublicApp(publicClientId);

  const [balance, currentScope, priorScope] = await Promise.all([
    fetchUsageBalance(client, input.externalUserId),
    client.fetchUsageForExternalUser({
      externalUserId: input.externalUserId,
      startDate: period.startDate,
      endDate: period.endDate,
      includeRetail: true,
    }),
    includePrior
      ? client.fetchUsageForExternalUser({
          externalUserId: input.externalUserId,
          startDate: period.priorStartDate,
          endDate: period.priorEndDate,
          includeRetail: true,
        })
      : Promise.resolve(null),
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
    seriesDayKeys: string[],
    seriesDaily: typeof dailyByPipeline,
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
        dayKeys: seriesDayKeys,
        dailyByPipeline: seriesDaily,
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
      pipelineModels: mapPipeline(
        currentScope.currentUser.pipelineModels,
        dayKeys,
        dailyByPipeline,
      ),
      dailyByPipeline,
    },
    prior: priorScope
      ? {
          requestCount: priorScope.currentUser.requestCount,
          pipelineModels: mapPipeline(
            priorScope.currentUser.pipelineModels,
            utcDateKeysForPeriod(period.priorStartDate, period.priorEndDate),
            [],
          ),
        }
      : {
          requestCount: 0,
          pipelineModels: [],
        },
  };
}

export type SignedTicketRequestRow = {
  time: string;
  clientId: string;
  appName?: string;
  externalUserId: string;
  gatewayRequestId: string;
  pipeline: string;
  modelId: string;
  networkFeeUsdMicros: string;
  feeWei?: string;
  pixels?: string;
  eventId: string;
};

export type AccountRequestsPayload = {
  items: SignedTicketRequestRow[];
  nextCursor: string | null;
  openMeterConfigured: boolean;
  clientId: string;
  externalUserId: string;
};

function issuerOriginFromConfig(): string {
  const config = readPymthouseM2mConfig();
  if (!config) {
    throw new PmtHouseError(
      "Pymthouse is not configured. Set PYMTHOUSE_ISSUER_URL, PYMTHOUSE_M2M_CLIENT_ID, and PYMTHOUSE_M2M_CLIENT_SECRET.",
      { status: 503, code: "pymthouse_required" },
    );
  }
  return new URL(config.issuerUrl).origin;
}

async function mintEndUserAccessToken(
  client: PmtHouseClient,
  externalUserId: string,
): Promise<string> {
  try {
    const minted = await client.mintUserAccessToken({ externalUserId });
    return minted.access_token;
  } catch (error) {
    if (
      error instanceof PmtHouseError &&
      error.status === 404 &&
      error.code === "not_found"
    ) {
      await client.upsertAppUser({ externalUserId });
      const minted = await client.mintUserAccessToken({ externalUserId });
      return minted.access_token;
    }
    throw error;
  }
}

/**
 * List signed-ticket requests for one external user via end-user Bearer scope
 * (`GET /api/v1/user/usage/requests`). Subject is forced by the minted JWT.
 */
export async function fetchAccountRequestsForExternalUser(input: {
  externalUserId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<AccountRequestsPayload> {
  const publicClientId = readPublicClientId();
  const client = createPmtHouseClientForPublicApp(publicClientId);
  const accessToken = await mintEndUserAccessToken(client, input.externalUserId);

  const url = new URL(`${issuerOriginFromConfig()}/api/v1/user/usage/requests`);
  if (input.cursor) url.searchParams.set("cursor", input.cursor);
  if (input.limit != null) url.searchParams.set("limit", String(input.limit));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const raw = await response.text();
  let body: (AccountRequestsPayload & { error?: string }) | null = null;
  try {
    body = raw ? (JSON.parse(raw) as AccountRequestsPayload & { error?: string }) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const notDeployed =
      response.status === 404
        ? " End-user usage/requests is not available on this PymtHouse deployment yet."
        : "";
    throw new PmtHouseError(
      (body?.error ?? `Signed-ticket requests failed (${response.status})`) + notDeployed,
      {
        status: response.status,
        code: "pymthouse_http_error",
        details: body ?? undefined,
      },
    );
  }

  return {
    items: body?.items ?? [],
    nextCursor: body?.nextCursor ?? null,
    openMeterConfigured: body?.openMeterConfigured !== false,
    clientId: body?.clientId ?? publicClientId,
    externalUserId: body?.externalUserId ?? input.externalUserId,
  };
}
