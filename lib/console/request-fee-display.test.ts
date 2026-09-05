import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatExactUsdMicrosString,
  formatUsdFromWei,
  requestFeeDisplay,
} from "./request-fee-display";

test("formatExactUsdMicrosString matches PymtHouse ingest micros", () => {
  assert.equal(formatExactUsdMicrosString("0.932"), "$0.000000932");
  assert.equal(formatExactUsdMicrosString("932"), "$0.000932");
  assert.equal(formatExactUsdMicrosString("1000"), "$0.001");
  assert.equal(formatExactUsdMicrosString("15"), "< $0.0001");
  assert.equal(formatExactUsdMicrosString("0"), null);
  assert.equal(formatExactUsdMicrosString("0.0"), null);
});

test("formatUsdFromWei renders full sub-micro ticket valuation", () => {
  const label = formatUsdFromWei("131568070", "1897.485");
  assert.ok(label);
  assert.ok(label.startsWith("$0.000000"));
  assert.equal(formatUsdFromWei("0", "1897.485"), null);
});

test("requestFeeDisplay rounds history prices to four decimal places", () => {
  assert.deepEqual(requestFeeDisplay({ networkFeeUsdMicros: "10011.632431" }), {
    display: "$0.0100",
    exact: "$0.010011632431",
  });
  assert.deepEqual(requestFeeDisplay({ networkFeeUsdMicros: "9940" }), {
    display: "$0.0099",
    exact: "$0.00994",
  });
  assert.deepEqual(requestFeeDisplay({ networkFeeUsdMicros: "0.932" }), {
    display: "<$0.0001",
    exact: "$0.000000932",
  });
  assert.deepEqual(requestFeeDisplay({ networkFeeUsdMicros: "0" }), {
    display: "$0",
    exact: "$0",
  });
});
