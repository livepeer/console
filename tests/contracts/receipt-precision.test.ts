import { expect, it } from "vitest";
import { sanitizeBillingReceipt } from "@/lib/console/billing-receipts";
import type { SignedTicketRequestRow } from "@/lib/console/account-usage";
const row = (fields: Record<string, string | undefined>) =>
  ({
    eventId: "evt",
    gatewayRequestId: "job",
    ...fields,
  }) as SignedTicketRequestRow;
it("accepts exact column boundaries", () => {
  expect(
    sanitizeBillingReceipt(
      row({
        networkFeeUsdMicros: "9".repeat(60) + "." + "9".repeat(18),
        feeWei: "9".repeat(78),
      })
    )
  ).not.toBeNull();
});
it.each([
  { networkFeeUsdMicros: "9".repeat(61) },
  { pixels: "0." + "1".repeat(19) },
  { feeWei: "1.1" },
  { feeWei: "1.0" },
  { feeWei: "9".repeat(79) },
])("rejects out-of-range receipts before a batch write", (fields) => {
  const batch = [row(fields), row({ feeWei: "42" })]
    .map(sanitizeBillingReceipt)
    .filter(Boolean);
  expect(batch).toHaveLength(1);
});
