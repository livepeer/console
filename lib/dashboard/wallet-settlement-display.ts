import type { BillingState, BillingStatus } from "@pymthouse/builder-sdk";
import { microsToUsd } from "./usage-capability-display";

/** Wallet strip amounts: always two decimals (matches prepaid `$0.00`). */
export function formatWalletUsd(micros: string | null | undefined): string {
  if (!micros?.trim()) return "0.00";
  return microsToUsd(micros).toFixed(2);
}

function parseUsdMicros(raw: string | null | undefined): bigint {
  const trimmed = raw?.trim();
  if (!trimmed || !/^-?\d+$/.test(trimmed)) return BigInt(0);
  try {
    return BigInt(trimmed);
  } catch {
    return BigInt(0);
  }
}

/** Signed wallet dollars with an explicit minus (`-$1.25` / `$0.00`). */
export function formatSignedWalletUsd(micros: bigint): string {
  const negative = micros < BigInt(0);
  const abs = negative ? -micros : micros;
  const formatted = (Number(abs) / 1_000_000).toFixed(2);
  return negative ? `-$${formatted}` : `$${formatted}`;
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

export type AvailableRunway = {
  usdMicros: string;
  /** Display with `$` / `-$`. */
  usd: string;
  tone: SpendPostureTone;
  /** Breakdown under the big number, or null when both sides are zero. */
  detail: string | null;
};

/**
 * Signed runway: included remaining + prepaid − unbilled debt.
 * Goes negative once spend accrues against the overage ceiling.
 */
export function availableRunway(state: BillingState): AvailableRunway {
  const included = parseUsdMicros(
    state.funding.includedUsage?.remaining.usdMicros ??
      state.funding.included.usdMicros,
  );
  const prepaid = parseUsdMicros(state.funding.prepaid.usdMicros);
  const debt = parseUsdMicros(state.funding.overage.unbilledDebt?.usdMicros);
  const available = included + prepaid - debt;

  let tone: SpendPostureTone = "ok";
  if (available < BigInt(0)) {
    if (state.status === "blocked") tone = "danger";
    else if (state.status === "at_risk") tone = "warn";
    else tone = "info";
  }

  let detail: string | null = null;
  if (available < BigInt(0)) {
    detail = `Unbilled $${formatWalletUsd(debt.toString())}`;
  } else {
    const parts: string[] = [];
    if (included > BigInt(0)) {
      parts.push(`Included $${formatWalletUsd(included.toString())}`);
    }
    if (prepaid > BigInt(0)) {
      parts.push(`Credits $${formatWalletUsd(prepaid.toString())}`);
    }
    detail = parts.length > 0 ? parts.join(" · ") : null;
  }

  return {
    usdMicros: available.toString(),
    usd: formatSignedWalletUsd(available),
    tone,
    detail,
  };
}

/**
 * Small footnote for the soft overage ceiling. Null when unlimited (ceiling 0).
 */
export function overageLimitNote(state: BillingState): string | null {
  const ceiling = state.funding.overage.ceiling;
  if (!ceiling?.usdMicros || ceiling.usdMicros === "0") return null;
  if (state.status === "blocked") return "Overage limit reached";
  const remaining = state.funding.overage.remaining;
  if (remaining && remaining.usdMicros !== "0") {
    return `Overage limit $${ceiling.usd} · $${remaining.usd} left`;
  }
  return `Overage limit $${ceiling.usd}`;
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
