import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveBillingPlanAction,
  deriveBillingSubscriptionUiState,
} from "./billing-subscription-state";

test("derives no subscription as a subscribe state", () => {
  const state = deriveBillingSubscriptionUiState(null);

  assert.deepEqual(state, { kind: "none", planId: null });
  assert.equal(deriveBillingPlanAction(state, "pro"), "subscribe");
});

test("marks the active plan current and other plans switchable", () => {
  const state = deriveBillingSubscriptionUiState({
    planId: "pro",
    status: "active",
  });

  assert.deepEqual(state, { kind: "active", planId: "pro" });
  assert.equal(deriveBillingPlanAction(state, "pro"), "current");
  assert.equal(deriveBillingPlanAction(state, "scale"), "change_plan");
});

test("routes pending subscriptions to checkout retry", () => {
  const state = deriveBillingSubscriptionUiState({
    planId: "pro",
    status: "pending",
  });

  assert.deepEqual(state, { kind: "pending", planId: "pro" });
  assert.equal(deriveBillingPlanAction(state, "pro"), "retry_checkout");
  assert.equal(deriveBillingPlanAction(state, "scale"), "retry_checkout");
});
