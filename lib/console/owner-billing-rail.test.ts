import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogPlanIdForOwnerKey,
  isOwnerPaidPlanKey,
  isOwnerStarterPlanKey,
  isOwnerWalletPlanKey,
  mapOwnerCatalogPlans,
  mapOwnerUserSubscription,
  OWNER_STARTER_PLAN_KEY,
} from "./owner-billing-rail";

test("classifies Owner Sandbox Starter keys including amount variants", () => {
  assert.equal(isOwnerStarterPlanKey("pymthouse_owner_starter"), true);
  assert.equal(isOwnerStarterPlanKey("pymthouse_owner_starter_50000000"), true);
  assert.equal(isOwnerStarterPlanKey("app_starter"), false);
  assert.equal(isOwnerStarterPlanKey(""), false);
});

test("classifies Owner Paid tier keys", () => {
  assert.equal(isOwnerPaidPlanKey("pymthouse_owner_paid"), true);
  assert.equal(isOwnerPaidPlanKey("pymthouse_owner_paid_producer"), true);
  assert.equal(isOwnerPaidPlanKey("pymthouse_owner_starter"), false);
});

test("owner-wallet plan keys cover starter and paid", () => {
  assert.equal(isOwnerWalletPlanKey("pymthouse_owner_starter"), true);
  assert.equal(isOwnerWalletPlanKey("pymthouse_owner_paid_scale"), true);
  assert.equal(isOwnerWalletPlanKey("pln_retail"), false);
});

test("catalog ids collapse starter variants onto the shared Starter row", () => {
  assert.equal(
    catalogPlanIdForOwnerKey("pymthouse_owner_starter_12000000"),
    OWNER_STARTER_PLAN_KEY
  );
  assert.equal(
    catalogPlanIdForOwnerKey("pymthouse_owner_paid_producer"),
    "pymthouse_owner_paid_producer"
  );
  assert.equal(catalogPlanIdForOwnerKey("retail"), null);
});

test("owner catalog lists Sandbox Starter then paid tiers", () => {
  const plans = mapOwnerCatalogPlans([
    {
      key: "pymthouse_owner_paid_producer",
      name: "Producer",
      monthlyFeeUsd: "20.00",
      includedUsdMicros: "5000000",
      sortOrder: 1,
    },
  ]);
  assert.equal(plans[0]?.id, OWNER_STARTER_PLAN_KEY);
  assert.equal(plans[0]?.isStarterDefault, true);
  assert.equal(plans[1]?.id, "pymthouse_owner_paid_producer");
  assert.equal(plans[1]?.type, "subscription");
});

test("owner subscription maps live Starter onto the catalog Starter id", () => {
  const sub = mapOwnerUserSubscription({
    livePaidPlanKey: null,
    pendingDowngrade: null,
    subscriptions: [
      {
        subscriptionId: "sub_1",
        status: "active",
        planName: "Owner Sandbox Starter",
        openMeterPlanKey: "pymthouse_owner_starter",
        activeTo: null,
      },
    ],
  });
  assert.equal(sub.planId, OWNER_STARTER_PLAN_KEY);
  assert.equal(sub.planName, "Owner Sandbox Starter");
  assert.equal(sub.status, "active");
});
