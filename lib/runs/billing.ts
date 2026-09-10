import type { JsonValue, RunBillingSummary } from "./types";

const DECIMAL = /^\d+(?:\.\d+)?$/;

/** Add non-negative decimal strings without passing through IEEE-754 numbers. */
export function addDecimalStrings(left: string, right: string): string {
  if (!DECIMAL.test(left) || !DECIMAL.test(right))
    throw new Error("invalid_decimal");
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftDigits = BigInt(leftWhole + leftFraction.padEnd(scale, "0"));
  const rightDigits = BigInt(rightWhole + rightFraction.padEnd(scale, "0"));
  const sum = (leftDigits + rightDigits).toString().padStart(scale + 1, "0");
  if (!scale) return sum;
  const whole = sum.slice(0, -scale) || "0";
  const fraction = sum.slice(-scale).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function billingSummaryFromEvents(
  events: { metadata: Record<string, JsonValue> }[]
): RunBillingSummary | null {
  let total = "0";
  let receiptCount = 0;
  for (const event of events) {
    const value = event.metadata.networkFeeUsdMicros;
    if (event.metadata.kind !== "billing_usage" || typeof value !== "string")
      continue;
    if (!DECIMAL.test(value)) continue;
    total = addDecimalStrings(total, value);
    receiptCount += 1;
  }
  return receiptCount ? { networkFeeUsdMicros: total, receiptCount } : null;
}

export function billingSummaryFromReceipts(
  receipts: { networkFeeUsdMicros: string | null }[]
): RunBillingSummary | null {
  let total = "0";
  let receiptCount = 0;
  for (const receipt of receipts) {
    const value = receipt.networkFeeUsdMicros;
    if (!value || !DECIMAL.test(value)) continue;
    total = addDecimalStrings(total, value);
    receiptCount += 1;
  }
  return receiptCount ? { networkFeeUsdMicros: total, receiptCount } : null;
}
