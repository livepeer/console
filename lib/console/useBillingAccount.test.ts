import assert from "node:assert/strict";
import test from "node:test";
import { isSoftBillingListUnavailable } from "./useBillingAccount";

test("503 Billing unavailable is a soft empty list, not a hard UI failure", () => {
  assert.equal(isSoftBillingListUnavailable(503, "Billing unavailable"), true);
  assert.equal(isSoftBillingListUnavailable(503, undefined), true);
  assert.equal(isSoftBillingListUnavailable(503, "  Billing unavailable  "), true);
});

test("other statuses and messages remain hard failures", () => {
  assert.equal(isSoftBillingListUnavailable(500, "Billing unavailable"), false);
  assert.equal(isSoftBillingListUnavailable(502, "upstream timeout"), false);
  assert.equal(isSoftBillingListUnavailable(404, "not found"), false);
  assert.equal(isSoftBillingListUnavailable(503, "rate limited"), false);
});
