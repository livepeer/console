import assert from "node:assert/strict";
import test from "node:test";
import {
  dateInputToEffectiveAtIso,
  defaultCancelTimingChoice,
  canCancelBillingSubscription,
  deriveBillingPlanAction,
  deriveBillingSubscriptionUiState,
  formatBillingPlanPrice,
  formatIncludedUsdMicros,
  formatPendingCancelDate,
  isNothingToResumeError,
  paidCatalogPlanIds,
  resolveApplicablePendingCancel,
  resolveTimingPayload,
  includedUsageFeatureLabel,
  starterIncludedUsageLabel,
  toDateInputValue,
  withCurrentPlanInDisplayList,
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

test("Starter / non-catalog plans cannot be canceled — only paid catalog plans can", () => {
  const starterActive = deriveBillingSubscriptionUiState({
    planId: "starter",
    status: "active",
  });
  assert.equal(
    canCancelBillingSubscription(starterActive, ["pro", "scale"], true),
    false,
  );
  assert.equal(
    canCancelBillingSubscription(
      deriveBillingSubscriptionUiState({ planId: "pro", status: "active" }),
      ["pro", "scale"],
      true,
    ),
    true,
  );
  assert.equal(
    canCancelBillingSubscription(starterActive, ["pro"], false),
    false,
  );
});

test("withCurrentPlanInDisplayList injects Starter when missing from catalog", () => {
  const paid = [
    {
      id: "pro",
      name: "Pro",
      type: "subscription",
      status: "active",
      priceAmount: "29",
      priceCurrency: "USD",
      billingCycle: "monthly",
      chargeThresholdUsdMicros: null,
      resolvedBehavior: null,
      capabilityCount: 3,
      isStarterDefault: false,
    },
  ];

  const withStarter = withCurrentPlanInDisplayList(paid, {
    planId: "starter",
    planName: "Starter",
  });
  assert.equal(withStarter.length, 2);
  assert.equal(withStarter[0]?.id, "starter");
  assert.equal(withStarter[0]?.name, "Starter");
  assert.equal(withStarter[0]?.type, "free");
  assert.equal(withStarter[0]?.isStarterDefault, true);
  assert.equal(withStarter[1]?.id, "pro");

  // Already in catalog — no duplicate
  assert.deepEqual(
    withCurrentPlanInDisplayList(paid, { planId: "pro", planName: "Pro" }),
    paid,
  );

  // No subscription — catalog only
  assert.deepEqual(withCurrentPlanInDisplayList(paid, null), paid);

  // Starter alone when no paid plans published
  const starterOnly = withCurrentPlanInDisplayList([], {
    planId: "starter",
    planName: "Starter",
  });
  assert.equal(starterOnly.length, 1);
  assert.equal(starterOnly[0]?.name, "Starter");
});

test("paidCatalogPlanIds excludes Starter defaults", () => {
  assert.deepEqual(
    paidCatalogPlanIds([
      { id: "starter", isStarterDefault: true },
      { id: "pro", isStarterDefault: false },
      { id: "legacy" },
    ]),
    ["pro", "legacy"],
  );
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

test("cancel-at-period-end is canceling from pendingCancel or inactive status", () => {
  const fromPending = deriveBillingSubscriptionUiState({
    planId: "starter",
    status: "canceled",
    currentPeriodEnd: "2026-09-07T17:35:18.109Z",
    pendingCancel: {
      subscriptionId: "sub_starter",
      planId: "starter",
      planName: "Starter",
      effectiveAt: "2026-09-07T17:35:18.109Z",
    },
  });
  assert.deepEqual(fromPending, { kind: "canceling", planId: "starter" });
  assert.equal(deriveBillingPlanAction(fromPending, "starter"), "current");
  assert.equal(deriveBillingPlanAction(fromPending, "pro"), "change_plan");

  const fromInactive = deriveBillingSubscriptionUiState({
    planId: "starter",
    status: "inactive",
    currentPeriodEnd: "2026-09-07T17:35:18.109Z",
  });
  assert.deepEqual(fromInactive, { kind: "canceling", planId: "starter" });

  // pendingCancel alone (no subscription.planId) still surfaces canceling
  const pendingOnly = deriveBillingSubscriptionUiState({
    planId: null,
    status: null,
    pendingCancel: {
      subscriptionId: "sub_starter",
      planId: "starter",
      effectiveAt: "2026-09-07T17:35:18.109Z",
    },
  });
  assert.deepEqual(pendingOnly, { kind: "canceling", planId: "starter" });
});

test("a pendingCancel for a superseded plan is ignored", () => {
  const subscription = {
    planId: "payg",
    planName: "Pay as you go",
    status: "active",
    pendingCancel: {
      subscriptionId: "sub_m2m",
      planId: "m2m",
      planName: "m2m user plan",
      effectiveAt: "2026-09-07T17:35:18.109Z",
    },
  };

  const state = deriveBillingSubscriptionUiState(subscription);
  assert.deepEqual(state, { kind: "active", planId: "payg" });
  assert.equal(deriveBillingPlanAction(state, "payg"), "current");
  assert.equal(deriveBillingPlanAction(state, "m2m"), "change_plan");
  assert.equal(resolveApplicablePendingCancel(subscription), null);
});

test("isNothingToResumeError reconciles only the upstream nothing_to_resume code", () => {
  assert.equal(isNothingToResumeError("nothing_to_resume"), true);
  // Sibling resume branches are real failures, whatever their status class.
  assert.equal(isNothingToResumeError("resume_failed"), false);
  assert.equal(isNothingToResumeError("confirm_required"), false);
  assert.equal(isNothingToResumeError("openmeter_unavailable"), false);
  // An unrelated 4xx (401/403/404) carries no code, or the SDK's sentinel.
  assert.equal(isNothingToResumeError("pymthouse_http_error"), false);
  assert.equal(isNothingToResumeError(undefined), false);
});

test("resume errors are classified by code, not status class", async () => {
  const { ResumeSubscriptionError } = await import("./useBillingPlans");

  const nothingToResume = new ResumeSubscriptionError(
    "No scheduled cancellation to undo",
    404,
    "nothing_to_resume",
  );
  assert.equal(isNothingToResumeError(nothingToResume.code), true);

  // 502 resume_failed: a resume target existed but Konnect restore threw.
  const resumeFailed = new ResumeSubscriptionError(
    "Could not cancel the scheduled cancellation",
    502,
    "resume_failed",
  );
  assert.equal(isNothingToResumeError(resumeFailed.code), false);

  // Unrelated 4xx that the old status heuristic wrongly reported as success.
  const unauthorized = new ResumeSubscriptionError("Unauthorized", 401, undefined);
  assert.equal(isNothingToResumeError(unauthorized.code), false);
  const unrelatedNotFound = new ResumeSubscriptionError(
    "Not Found",
    404,
    "pymthouse_http_error",
  );
  assert.equal(isNothingToResumeError(unrelatedNotFound.code), false);
});

test("user-not-found is recognized with and without an upstream code", async () => {
  const { PmtHouseError } = await import("@pymthouse/builder-sdk");
  const { isUserNotFoundError } = await import("./pymthouse-errors");

  // The mint-token route answers `{"error":"not_found"}` with no `code`, so the
  // SDK reports code as its `pymthouse_http_error` sentinel — auto-provisioning
  // must still trigger.
  assert.equal(
    isUserNotFoundError(
      new PmtHouseError("not_found", {
        status: 404,
        code: "pymthouse_http_error",
        details: { error: "not_found" },
      }),
    ),
    true,
  );
  // REST shape: prose on message, machine code on `code`.
  assert.equal(
    isUserNotFoundError(
      new PmtHouseError("App user not found", {
        status: 404,
        code: "not_found",
        details: { error: "App user not found", code: "not_found" },
      }),
    ),
    true,
  );
  // An unrelated 404 must not provision a user.
  assert.equal(
    isUserNotFoundError(
      new PmtHouseError("Subscription not found", {
        status: 404,
        code: "pymthouse_http_error",
        details: { error: "Subscription not found" },
      }),
    ),
    false,
  );
  assert.equal(
    isUserNotFoundError(
      new PmtHouseError("boom", { status: 500, code: "not_found" }),
    ),
    false,
  );
  assert.equal(isUserNotFoundError(new Error("network down")), false);
});

test("resolveCancelingEffectiveAt prefers pendingCancel then period end", async () => {
  const {
    resolveCancelingEffectiveAt,
    resolveCancelingPlanName,
  } = await import("./billing-subscription-state");
  assert.equal(
    resolveCancelingEffectiveAt({
      planId: "starter",
      status: "canceled",
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
      pendingCancel: {
        subscriptionId: "s1",
        effectiveAt: "2026-09-07T17:35:18.109Z",
      },
    }),
    "2026-09-07T17:35:18.109Z",
  );
  assert.equal(
    resolveCancelingPlanName({
      planName: "__pymthouse_starter__",
      pendingCancel: { planName: "Starter" },
    }),
    "Starter",
  );
});

test("formatPendingCancelDate formats UTC calendar day", () => {
  assert.equal(
    formatPendingCancelDate("2026-08-20T12:00:00.000Z"),
    "Aug 20, 2026",
  );
  assert.equal(formatPendingCancelDate(null), "the end of this period");
  assert.equal(
    formatPendingCancelDate("not-a-date"),
    "the end of this period",
  );
});

test("cancel timing helpers default to immediate and map date inputs", () => {
  assert.equal(defaultCancelTimingChoice(), "immediate");
  assert.equal(toDateInputValue("2026-08-08T00:00:00.000Z"), "2026-08-08");
  assert.equal(
    dateInputToEffectiveAtIso("2026-08-15"),
    "2026-08-15T12:00:00.000Z",
  );
  assert.deepEqual(
    resolveTimingPayload({
      choice: "next_billing_cycle",
      customDateYmd: "",
    }),
    { timing: "next_billing_cycle" },
  );
  assert.deepEqual(
    resolveTimingPayload({ choice: "immediate", customDateYmd: "" }),
    { timing: "immediate" },
  );
  assert.deepEqual(
    resolveTimingPayload({
      choice: "custom",
      customDateYmd: "2026-08-15",
    }),
    { effectiveAt: "2026-08-15T12:00:00.000Z" },
  );
});

test("formatIncludedUsdMicros converts OpenMeter discounts.usage micros", () => {
  assert.equal(formatIncludedUsdMicros("10000000"), "$10");
  assert.equal(formatIncludedUsdMicros("2500000"), "$2.50");
  assert.equal(formatIncludedUsdMicros("0"), null);
  assert.equal(formatIncludedUsdMicros(null), null);
  assert.equal(formatIncludedUsdMicros("not-a-number"), null);
});

test("formatBillingPlanPrice prefers Starter included usage over $0 fee", () => {
  assert.deepEqual(
    formatBillingPlanPrice({
      type: "free",
      priceAmount: "0",
      priceCurrency: "USD",
      billingCycle: "monthly",
      includedUsdMicros: "10000000",
      isStarterDefault: true,
    }),
    { price: "$10", priceSub: " · included" },
  );
  assert.equal(
    includedUsageFeatureLabel({ includedUsdMicros: "10000000" }),
    "$10 included usage",
  );
  assert.equal(
    includedUsageFeatureLabel({ includedUsdMicros: null }),
    null,
  );
  assert.equal(
    starterIncludedUsageLabel({ includedUsdMicros: "10000000" }),
    "$10 included usage",
  );
  assert.equal(
    starterIncludedUsageLabel({ includedUsdMicros: null }),
    "Free included usage",
  );
});
