"use client";

import Link from "next/link";
import {
  formatRunLatency,
  formatRunRelativeTime,
} from "@/lib/dashboard/utils";
import type { AccountActivityRow } from "@/lib/dashboard/types";

/**
 * JobsTable — the single Linear-style jobs list used everywhere we render
 * recent inferences:
 *
 *   1. Home "Recent jobs" panel
 *   2. Standalone `/dashboard/jobs` view
 *   3. Model detail page Jobs tab (filtered to one capability)
 *
 * Row vocabulary (left → right):
 *   8px status dot · mono short id · model name · pipeline pill · latency ·
 *   cost · via (signer) · relative time
 *
 * Columns share one grid template so the optional header row and body rows
 * align exactly. Each row is a Link to `/dashboard/usage?request={id}` so
 * clicking a row deep-links into the request inspector.
 */
export interface JobsTableProps {
  rows: AccountActivityRow[];
  /** Render the mono-uppercase column-header strip above the body rows. Off by default — most embedded uses (model detail, dense home variants) skip it; the standalone runs view turns it on. */
  showHeader?: boolean;
  /** Wrap the table in a bordered, rounded panel. Off when the surrounding chrome already provides borders (e.g. the standalone runs route's full-bleed list). */
  bordered?: boolean;
  /** Density preset:
   *  - `compact` (default) — 70px stat columns, tight `py-[7px]` rows; matches the home panel.
   *  - `cozy` — 80px stat columns, `py-2` rows; matches the standalone runs view.
   */
  density?: "compact" | "cozy";
  /** Optional subset filter applied before render (kept here so callers don't have to re-implement). */
  className?: string;
}

export default function JobsTable({
  rows,
  showHeader = false,
  bordered = true,
  density = "compact",
  className,
}: JobsTableProps) {
  // Static class strings — Tailwind's JIT can't resolve interpolated arbitrary
  // values, so each density preset is spelled out in full.
  const cols =
    density === "cozy"
      ? "grid items-center gap-3 px-5 grid-cols-[8px_minmax(0,1fr)_80px_80px_80px_80px]"
      : "grid items-center gap-3 px-4 grid-cols-[8px_minmax(0,1fr)_70px_70px_70px_70px]";
  const rowPadY = density === "cozy" ? "py-2" : "py-[7px]";

  const wrapperClass = [
    bordered
      ? "overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card"
      : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={wrapperClass || undefined}>
      {showHeader && (
        <div
          className={`${cols} border-b border-hairline bg-dark py-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled`}
        >
          <span aria-hidden="true" />
          <span>Run</span>
          <span className="text-right">Latency</span>
          <span className="text-right">Cost</span>
          <span className="text-right">Via</span>
          <span className="text-right">Time</span>
        </div>
      )}
      {rows.map((row, i) => {
        const tone =
          row.status === "success"
            ? "bg-green-bright"
            : row.status === "timeout"
              ? "bg-warm"
              : "bg-red-400";
        const shadowRing =
          row.status === "success"
            ? "shadow-[0_0_0_2px_rgba(64,191,134,0.18)]"
            : "";
        return (
          <Link
            key={row.id}
            href={`/dashboard/usage?request=${row.id}`}
            className={`${cols} ${rowPadY} text-[12.5px] transition-colors hover:bg-hover ${
              i > 0 || showHeader ? "border-t border-hairline" : ""
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${tone} ${shadowRing}`}
              aria-hidden="true"
            />
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="shrink-0 font-mono text-[11.5px] text-fg-faint tabular-nums">
                {row.id.slice(-7)}
              </span>
              <span className="min-w-0 truncate font-medium text-fg-strong">
                {row.model}
              </span>
              <span className="shrink-0 rounded-[3px] border border-hairline px-1.5 py-px font-mono text-[10.5px] text-fg-faint">
                {row.pipeline}
              </span>
            </div>
            <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-strong">
              {formatRunLatency(row.latencyMs)}
            </span>
            <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-strong">
              {row.costDisplay}
            </span>
            <span className="truncate text-right font-mono text-[11.5px] text-fg-faint">
              {row.signerLabel}
            </span>
            <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-faint">
              {formatRunRelativeTime(row.timestamp)}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
