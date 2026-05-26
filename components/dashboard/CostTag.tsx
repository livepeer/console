import type { ReactNode } from "react";

type CostMode = "free" | "cost" | "test";

interface CostTagProps {
  /**
   * `free` — user is on the free tier; this run won't be billed.
   * `cost` — render the explicit per-request cost (pass via `cost`).
   * `test` — playground simulation that doesn't charge regardless of tier.
   */
  mode: CostMode;
  /** Required when `mode === "cost"`. Example: "$0.003" or "$0.003 / req". */
  cost?: string;
  /** Slot for a leading icon (e.g. Zap). Optional. */
  icon?: ReactNode;
}

const STYLES: Record<CostMode, string> = {
  free: "bg-green-bright/15 text-green-bright ring-green-bright/25",
  cost: "bg-tint text-fg-strong ring-[var(--color-border-subtle)]",
  test: "bg-tint text-fg-muted ring-[var(--color-border-hairline)]",
};

const LABELS: Record<CostMode, string> = {
  free: "Free tier",
  cost: "",
  test: "Test run",
};

/**
 * CostTag — small ring-bordered chip used next to inference triggers (Run button)
 * to disclose what a given action costs at a glance. Designed to live inline
 * with a primary action button, so it should be small and quiet.
 */
export default function CostTag({ mode, cost, icon }: CostTagProps) {
  const label = mode === "cost" ? cost ?? "" : LABELS[mode];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STYLES[mode]}`}
    >
      {icon}
      {label}
    </span>
  );
}
