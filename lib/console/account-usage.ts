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
