import type { SignedTicketRequestRow } from "./account-usage";
import type { JsonValue } from "@/lib/runs/types";

export type SanitizedBillingReceipt = {
  eventId: string;
  gatewayRequestId: string;
  metadata: Record<string, JsonValue>;
};

const DECIMAL = /^\d+(?:\.\d+)?$/;

/** Keep only reviewed receipt fields; upstream payloads and prompts never enter Neon. */
export function sanitizeBillingReceipt(
  item: SignedTicketRequestRow
): SanitizedBillingReceipt | null {
  if (
    !item.eventId ||
    item.eventId.length > 512 ||
    !item.gatewayRequestId ||
    item.gatewayRequestId.length > 512
  )
    return null;
  const metadata: Record<string, JsonValue> = {
    billingEventId: item.eventId,
    ticketGatewayRequestId: item.gatewayRequestId,
  };
  for (const [key, value] of [
    ["pipeline", item.pipeline],
    ["modelId", item.modelId],
  ] as const) {
    if (typeof value === "string" && value.length <= 512) metadata[key] = value;
  }
  for (const key of [
    "networkFeeUsdMicros",
    "feeWei",
    "ethUsdPrice",
    "pixels",
  ] as const) {
    const value = item[key];
    if (typeof value === "string" && value.length <= 128 && DECIMAL.test(value))
      metadata[key] = value;
  }
  if (
    typeof item.time === "string" &&
    item.time.length <= 64 &&
    Number.isFinite(Date.parse(item.time))
  )
    metadata.timestamp = new Date(item.time).toISOString();
  return { eventId: item.eventId, gatewayRequestId: item.gatewayRequestId, metadata };
}
