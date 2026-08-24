import type { ReactNode } from "react";

interface KpiStripProps {
  /** Total stats — drives the desktop column count. */
  cols?: 3 | 4;
  /** The KpiCard children. */
  children: ReactNode;
  /** Optional className for the wrapper (e.g. margin overrides). */
  className?: string;
}

/**
 * KpiStrip — bordered single-row container with internal hairline dividers.
 *
 * Per the Livepeer Console design (Apr 2026): the row is one unit (one border
 * around the whole thing), with each KPI cell separated by a vertical hairline.
 * On mobile it stacks vertically with horizontal dividers instead. This shape
 * (rather than separated cards with their own borders) reads as a tight stat
 * strip rather than a row of widgets.
 *
 * Use with `<KpiCard>` children.
 */
const COL_CLASSES: Record<NonNullable<KpiStripProps["cols"]>, string> = {
  3: "grid grid-cols-1 sm:grid-cols-3",
  4: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export default function KpiStrip({
  cols = 4,
  children,
  className,
}: KpiStripProps) {
  return (
    <div
      className={`${COL_CLASSES[cols]} overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card divide-y divide-[var(--color-border-hairline)] sm:divide-y-0 sm:divide-x ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
