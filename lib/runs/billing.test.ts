import assert from "node:assert/strict";
import { test } from "node:test";
import { addDecimalStrings, billingSummaryFromEvents } from "./billing";

test("adds fractional USD micros without floating-point arithmetic", () => {
  assert.equal(addDecimalStrings("9007199254740993.125", "0.875"), "9007199254740994");
});

test("aggregates distinct persisted billing events and ignores other events", () => {
  assert.deepEqual(
    billingSummaryFromEvents([
      { metadata: { kind: "billing_usage", networkFeeUsdMicros: "0.932" } },
      { metadata: { kind: "billing_usage", networkFeeUsdMicros: "2.068" } },
      { metadata: { kind: "transition", networkFeeUsdMicros: "99" } },
    ]),
    { networkFeeUsdMicros: "3", receiptCount: 2 }
  );
});
