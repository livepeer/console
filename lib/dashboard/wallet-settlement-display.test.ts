import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BillingState } from "@pymthouse/builder-sdk";
import {
  collectionSchedule,
  overageBufferMeter,
  spendPostureBadge,
} from "@/lib/dashboard/wallet-settlement-display";

function money(usdMicros: string, usd: string) {
  return { usdMicros, usd, currency: "USD" };
}

function makeState(overrides: {
  status?: BillingState["status"];
  ceiling?: { usdMicros: string; usd: string };
  unbilledDebt?: { usdMicros: string; usd: string } | null;
  remaining?: { usdMicros: string; usd: string } | null;
  utilizationBps?: number | null;
  leadThreshold?: { usdMicros: string; usd: string };
}): BillingState {
  return {
    asOf: "2026-08-08T00:00:00.000Z",
    subject: {
      type: "owner",
      externalUserId: null,
      billingMode: "owner_rollup",
    },
    status: overrides.status ?? "overage",
    canSpend: true,
    reason: null,
    funding: {
      prepaid: money("0", "0.00"),
      included: money("0", "0.00"),
      spendable: money("0", "0.00"),
      overage: {
        eligible: true,
        ceiling: {
          ...money("2000000", "2.00"),
          ...(overrides.ceiling ?? {}),
        },
        unbilledDebt:
          overrides.unbilledDebt === undefined
            ? money("500000", "0.50")
            : overrides.unbilledDebt && {
                ...money("0", "0.00"),
                ...overrides.unbilledDebt,
              },
        remaining:
          overrides.remaining === undefined
            ? money("1500000", "1.50")
            : overrides.remaining && {
                ...money("0", "0.00"),
                ...overrides.remaining,
              },
        utilizationBps:
          overrides.utilizationBps === undefined
            ? 2500
            : overrides.utilizationBps,
        debtSource: "gathering_invoice",
      },
    },
    collection: {
      mode: "progressive_invoice",
      collector: "openmeter_stripe",
      paymentMethod: { hasDefault: true, brand: "visa", last4: "4242" },
      nextAction: "none",
      leadThreshold: {
        ...money("1000000", "1.00"),
        ...(overrides.leadThreshold ?? {}),
      },
      minimumCharge: money("500000", "0.50"),
      cycle: "MONTH",
      collectionInterval: "DAY",
      lastRaisedAt: null,
      nextRaiseEligibleAt: null,
    },
    explain: { headline: "", detail: "", docsUrl: "" },
  };
}

describe("spendPostureBadge", () => {
  it("colours each posture distinctly", () => {
    assert.deepEqual(spendPostureBadge("active"), {
      label: "Credits",
      tone: "ok",
    });
    assert.equal(spendPostureBadge("overage").tone, "info");
    assert.equal(spendPostureBadge("at_risk").tone, "warn");
    assert.equal(spendPostureBadge("blocked").tone, "danger");
  });
});

describe("overageBufferMeter", () => {
  it("reports debt against the ceiling with remaining headroom", () => {
    const meter = overageBufferMeter(makeState({}));
    assert.equal(meter?.primary, "$0.50 / $2.00");
    assert.equal(meter?.status, "$1.50 of buffer left");
    assert.equal(meter?.percent, 25);
  });

  it("says the buffer is used up when blocked", () => {
    const meter = overageBufferMeter(
      makeState({
        status: "blocked",
        unbilledDebt: { usdMicros: "2000000", usd: "2.00" },
        remaining: { usdMicros: "0", usd: "0.00" },
        utilizationBps: 10_000,
      }),
    );
    assert.equal(meter?.status, "Buffer used up");
    assert.equal(meter?.percent, 100);
  });

  it("clamps utilization above the ceiling to a full bar", () => {
    const meter = overageBufferMeter(makeState({ utilizationBps: 14_000 }));
    assert.equal(meter?.percent, 100);
  });

  it("hides the meter when there is no ceiling", () => {
    const meter = overageBufferMeter(
      makeState({ ceiling: { usdMicros: "0", usd: "0.00" } }),
    );
    assert.equal(meter, null);
  });

  it("hides the meter when debt could not be read", () => {
    const meter = overageBufferMeter(makeState({ unbilledDebt: null }));
    assert.equal(meter, null);
  });
});

describe("collectionSchedule", () => {
  it("names the amount trigger and the recurring sweep", () => {
    const copy = collectionSchedule(makeState({}));
    assert.match(copy, /\$1\.00/);
    assert.match(copy, /at least once a day/);
  });

  it("falls back to the sweep alone with no amount trigger", () => {
    const copy = collectionSchedule(
      makeState({ leadThreshold: { usdMicros: "0", usd: "0.00" } }),
    );
    assert.equal(copy, "Usage is invoiced every day.");
  });
});
