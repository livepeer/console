import type { AccountUsagePayload } from "@/lib/dashboard/pymthouse-bff";

/**
 * Runtime shape check for `/api/pymthouse/account-usage` responses.
 *
 * A 200 with a body that doesn't match `AccountUsagePayload` used to reach the
 * consumers as a well-typed value, so `data.period.end` (and the BigInt reads on
 * `current`/`balance`) threw during render. Covers the fields the consumers
 * dereference without a fallback — `clientId` and `priorPeriod` are carried by
 * the type but nothing reads them, so they're deliberately not checked.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPeriodBounds(value: unknown): boolean {
  return isRecord(value) && typeof value.start === "string" && typeof value.end === "string";
}

/** `balance` is legitimately null when the account has no prepaid grant. */
function isBalance(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.balanceUsdMicros === "string" &&
      typeof value.consumedUsdMicros === "string" &&
      typeof value.lifetimeGrantedUsdMicros === "string" &&
      typeof value.hasAccess === "boolean")
  );
}

function isPipelineRow(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.pipeline === "string" &&
    typeof value.modelId === "string" &&
    typeof value.requestCount === "number" &&
    Array.isArray(value.dailyRequests)
  );
}

function isDailyPipelineRow(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.pipeline === "string" &&
    typeof value.modelId === "string" &&
    typeof value.date === "string" &&
    typeof value.requestCount === "number"
  );
}

function isCurrentScope(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.requestCount === "number" &&
    typeof value.networkFeeUsdMicros === "string" &&
    typeof value.endUserBillableUsdMicros === "string" &&
    Array.isArray(value.pipelineModels) &&
    value.pipelineModels.every(isPipelineRow) &&
    Array.isArray(value.dailyByPipeline) &&
    value.dailyByPipeline.every(isDailyPipelineRow)
  );
}

function isPriorScope(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.requestCount === "number" &&
    Array.isArray(value.pipelineModels) &&
    value.pipelineModels.every(isPipelineRow)
  );
}

export function isAccountUsagePayload(value: unknown): value is AccountUsagePayload {
  return (
    isRecord(value) &&
    isPeriodBounds(value.period) &&
    Array.isArray(value.periodDayKeys) &&
    isBalance(value.balance) &&
    isCurrentScope(value.current) &&
    isPriorScope(value.prior)
  );
}

/** Reads the `{ error }` field off a non-OK body without trusting its shape. */
export function errorMessageFromBody(value: unknown): string | null {
  return isRecord(value) && typeof value.error === "string" ? value.error : null;
}
