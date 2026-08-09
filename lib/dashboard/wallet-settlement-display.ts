import type { BillingState, BillingStatus } from "@pymthouse/builder-sdk";
import { microsToUsd } from "@/lib/dashboard/usage-capability-display";

/** Wallet strip amounts: always two decimals (matches prepaid `$0.00`). */
export function formatWalletUsd(micros: string | null | undefined): string {
  if (!micros?.trim()) return "0.00";
  return microsToUsd(micros).toFixed(2);
}

export type SpendPostureTone = "ok" | "info" | "warn" | "danger";

/**
 * Short badge for the spend posture. The long-form copy comes from
 * `billingState.explain`, which the API owns so every surface says the same
 * thing; the dashboard only picks the label and the colour.
 */
export function spendPostureBadge(status: BillingStatus): {
  label: string;
  tone: SpendPostureTone;
} {
  switch (status) {
    case "active":
      return { label: "Credits", tone: "ok" };
    case "overage":
      return { label: "Pay as you go", tone: "info" };
    case "at_risk":
      return { label: "Collecting payment", tone: "warn" };
    case "blocked":
      return { label: "Paused", tone: "danger" };
  }
}

/**
 * Buffer consumption for the progress meter. Null when there is no ceiling to
 * fill, or when debt could not be read — the meter is hidden in both cases
 * rather than drawn at a made-up value.
 */
export function overageBufferMeter(state: BillingState): {
  primary: string;
  status: string;
  percent: number;
} | null {
  const { overage } = state.funding;
  const debt = overage.unbilledDebt;
  if (!debt || overage.ceiling.usdMicros === "0") return null;

  const percent = Math.min(
    100,
    Math.max(0, Math.round((overage.utilizationBps ?? 0) / 100)),
  );
  const remaining = overage.remaining?.usd ?? "0.00";
  return {
    primary: `$${debt.usd} / $${overage.ceiling.usd}`,
    status:
      state.status === "blocked"
        ? "Buffer used up"
        : `$${remaining} of buffer left`,
    percent,
  };
}

/** When the next invoice goes out, in the customer's terms. */
export function collectionSchedule(state: BillingState): string {
  const lead = state.collection.leadThreshold;
  if (lead.usdMicros === "0") {
    return `Usage is invoiced every ${state.collection.collectionInterval.toLowerCase()}.`;
  }
  return (
    `Usage is invoiced automatically once $${lead.usd} of it has built up, ` +
    `and at least once a ${state.collection.collectionInterval.toLowerCase()}.`
  );
}
