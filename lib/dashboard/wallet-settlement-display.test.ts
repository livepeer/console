import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BillingState } from "@pymthouse/builder-sdk";
import {
  availableRunway,
  collectionSchedule,
  overageLimitNote,
  spendPostureBadge,
} from "./wallet-settlement-display";

function money(usdMicros: string, usd: string) {
  return { usdMicros, usd, currency: "USD" };
}

function makeState(overrides: {
  status?: BillingState["status"];
  includedRemaining?: { usdMicros: string; usd: string };
  prepaid?: { usdMicros: string; usd: string };
  spendable?: { usdMicros: string; usd: string };
  ceiling?: { usdMicros: string; usd: string };
  unbilledDebt?: { usdMicros: string; usd: string } | null;
  remaining?: { usdMicros: string; usd: string } | null;
  utilizationBps?: number | null;
  leadThreshold?: { usdMicros: string; usd: string };
}): BillingState {
  const prepaid = {
    ...money("0", "0.00"),
    ...(overrides.prepaid ?? {}),
  };
  const includedRemaining = {
    ...money("0", "0.00"),
    ...(overrides.includedRemaining ?? {}),
  };
  const spendableDefaultMicros = (
    BigInt(prepaid.usdMicros || "0") + BigInt(includedRemaining.usdMicros || "0")
  ).toString();
  const spendable = {
    ...money(spendableDefaultMicros, "0.00"),
    ...(overrides.spendable ?? {}),
  };
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
      prepaid,
      included: includedRemaining,
      includedUsage: {
        total: money("10000000", "10.00"),
        remaining: includedRemaining,
        consumed: money("0", "0.00"),
        resetsAt: "2026-09-01T00:00:00.000Z",
        sourcePlan: null,
      },
      spendable,
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

describe("availableRunway", () => {
  it("sums included and prepaid when funded", () => {
    const runway = availableRunway(
      makeState({
        status: "active",
        includedRemaining: { usdMicros: "8000000", usd: "8.00" },
        prepaid: { usdMicros: "2500000", usd: "2.50" },
        unbilledDebt: null,
      }),
    );
    assert.equal(runway.usd, "$10.50");
    assert.equal(runway.usdMicros, "10500000");
    assert.equal(runway.tone, "ok");
    assert.equal(runway.detail, "Included $8.00 · Credits $2.50");
  });

  it("omits zero sides from the funded breakdown", () => {
    const runway = availableRunway(
      makeState({
        status: "active",
        includedRemaining: { usdMicros: "5000000", usd: "5.00" },
        prepaid: { usdMicros: "0", usd: "0.00" },
        unbilledDebt: null,
      }),
    );
    assert.equal(runway.usd, "$5.00");
    assert.equal(runway.detail, "Included $5.00");
  });

  it("goes negative once unbilled debt exceeds funding", () => {
    const runway = availableRunway(
      makeState({
        status: "overage",
        includedRemaining: { usdMicros: "0", usd: "0.00" },
        prepaid: { usdMicros: "0", usd: "0.00" },
        unbilledDebt: { usdMicros: "1250000", usd: "1.25" },
      }),
    );
    assert.equal(runway.usd, "-$1.25");
    assert.equal(runway.usdMicros, "-1250000");
    assert.equal(runway.tone, "info");
    assert.equal(runway.detail, "Unbilled $1.25");
  });

  it("keeps spendable while funded even if gathering debt is present", () => {
    const runway = availableRunway(
      makeState({
        status: "active",
        includedRemaining: { usdMicros: "0", usd: "0.00" },
        prepaid: { usdMicros: "5010000", usd: "5.01" },
        unbilledDebt: { usdMicros: "19990000", usd: "19.99" },
      }),
    );
    assert.equal(runway.usd, "$5.01");
    assert.equal(runway.usdMicros, "5010000");
    assert.equal(runway.detail, "Credits $5.01");
  });

  it("treats null debt as zero", () => {
    const runway = availableRunway(
      makeState({
        status: "active",
        includedRemaining: { usdMicros: "1000000", usd: "1.00" },
        unbilledDebt: null,
      }),
    );
    assert.equal(runway.usd, "$1.00");
  });

  it("uses danger tone when blocked below zero", () => {
    const runway = availableRunway(
      makeState({
        status: "blocked",
        includedRemaining: { usdMicros: "0", usd: "0.00" },
        unbilledDebt: { usdMicros: "2000000", usd: "2.00" },
      }),
    );
    assert.equal(runway.usd, "-$2.00");
    assert.equal(runway.tone, "danger");
  });
});

describe("overageLimitNote", () => {
  it("shows ceiling and remaining headroom while spendable", () => {
    const note = overageLimitNote(makeState({}));
    assert.equal(note, "Overage limit $2.00 · $1.50 left");
  });

  it("drops headroom when remaining is zero but not blocked", () => {
    const note = overageLimitNote(
      makeState({
        remaining: { usdMicros: "0", usd: "0.00" },
      }),
    );
    assert.equal(note, "Overage limit $2.00");
  });

  it("says the limit is reached when blocked", () => {
    const note = overageLimitNote(
      makeState({
        status: "blocked",
        unbilledDebt: { usdMicros: "2000000", usd: "2.00" },
        remaining: { usdMicros: "0", usd: "0.00" },
      }),
    );
    assert.equal(note, "Overage limit reached");
  });

  it("hides the note when there is no ceiling", () => {
    const note = overageLimitNote(
      makeState({ ceiling: { usdMicros: "0", usd: "0.00" } }),
    );
    assert.equal(note, null);
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
