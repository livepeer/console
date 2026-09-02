"use client";

import Link from "next/link";
import { formatCallMetric, formatRunRelativeTime } from "@/lib/console/utils";
import EnvTag from "@/components/console/EnvTag";
import StatusDot from "@/components/console/StatusDot";
import { useTickWhileActive } from "@/components/console/useTickWhileActive";
import type { AccountActivityRow } from "@/lib/console/types";

/**
 * CallsTable — the single Linear-style call list, used by:
 *   1. the Calls section on /usage (formerly the standalone /calls view)
 *   2. the app-detail Logs tab (filtered to one app)
 *
 * Rows open the call inspector at `/usage?request=<id>`, which is where the
 * drawer now lives.
 *
 * Row vocabulary (left → right):
 *   8px status dot · mono short id · model · pipeline pill · latency|duration ·
 *   cost · via (signer) · relative time
 *
 * The metric column adapts to the call's kind: a batch call reports **latency**
 * (one request/response), a live call reports **duration** (a streaming
 * session). The header follows the rows — "Latency" when they're all batch,
 * "Duration" when all live, "Elapsed" when mixed.
 */
export interface CallsTableProps {
  rows: AccountActivityRow[];
  showHeader?: boolean;
  bordered?: boolean;
  /** Density: `compact` (home-style) or `cozy` (standalone full-bleed). */
  density?: "compact" | "cozy";
  /** Render a per-row environment tag in the Call cell (for all-environment views). */
  showEnvironment?: boolean;
  /** Pin the column header while the rows scroll under it. Only meaningful
   *  when the caller puts this table inside a fixed-height scroll container. */
  stickyHeader?: boolean;
  /**
   * `full` — dot · call · metric · cost · via · time (the app Logs tab).
   * `requests` — dot · call · cost · time. Signed-ticket rows carry neither a
   * latency nor a distinct signer, so on /usage those two columns rendered
   * "—" and a truncated "Livepeer A…" on every row: two of six columns
   * saying nothing.
   */
  variant?: "full" | "requests";
  /**
   * Colour for the row's leading dot, keyed off the row. When given, the dot
   * encodes *which capability* the call hit — the same colour the Spend by
   * capability table uses — instead of the call's status. On /usage every
   * row is a signed ticket, which only exists for a completed, paid call,
   * so a status dot there could only ever be green and said nothing.
   */
  rowColor?: (row: AccountActivityRow) => string;
  className?: string;
}

export default function CallsTable({
  rows,
  showHeader = false,
  bordered = true,
  density = "compact",
  showEnvironment = false,
  stickyHeader = false,
  variant = "full",
  rowColor,
  className,
}: CallsTableProps) {
  const compact = variant === "requests";
  // Static class strings — Tailwind's JIT can't resolve interpolated arbitrary
  // values, so each density preset is spelled out in full.
  const cols = compact
    ? density === "cozy"
      ? "grid items-center gap-3 px-5 grid-cols-[minmax(0,1fr)_88px_88px]"
      : "grid items-center gap-3 px-4 grid-cols-[minmax(0,1fr)_76px_76px]"
    : density === "cozy"
      ? "grid items-center gap-3 px-5 grid-cols-[minmax(0,1fr)_80px_80px_80px_80px]"
      : "grid items-center gap-3 px-4 grid-cols-[minmax(0,1fr)_70px_70px_70px_70px]";
  const rowPadY = density === "cozy" ? "py-2.5" : "py-[7px]";

  // Metric column header follows the rows on screen (which the caller's
  // Batch/Live filter narrows): all batch → Latency, all live → Duration,
  // mixed → Elapsed.
  const kinds = new Set(rows.map((r) => r.kind));
  const metricLabel =
    kinds.size === 1 ? (kinds.has("live") ? "Duration" : "Latency") : "Elapsed";

  const nowMs = useTickWhileActive(rows.some((r) => r.status === "active"));

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
          className={`${cols} border-b border-hairline bg-dark py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-faint ${
            stickyHeader ? "sticky top-0 z-10" : ""
          }`}
        >
          <span>Call</span>
          {!compact && <span className="text-right">{metricLabel}</span>}
          <span className="text-right">Cost</span>
          {!compact && <span className="text-right">Via</span>}
          <span className="text-right">Time</span>
        </div>
      )}
      {rows.map((row, i) => {
        const active = row.status === "active";
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
            href={`/usage?request=${row.id}`}
            className={`${cols} ${rowPadY} text-[12.5px] transition-colors hover:bg-hover ${
              // The header already draws its own bottom hairline; giving the
              // first row a top one too stacked them into a 2px divider.
              i > 0 ? "border-t border-hairline" : ""
            }`}
          >
            {/* Status dot sits inside the first cell, not in a column of its
                own, so the header label lines up with the breakdown table's
                on /usage (both start at the padding edge). */}
            <div className="flex min-w-0 items-center gap-2.5">
              {rowColor ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: rowColor(row) }}
                  aria-hidden="true"
                />
              ) : active ? (
                // Liveness pulse for an in-progress session (warm per the
                // liveness color convention).
                <StatusDot tone="warm" size="md" />
              ) : (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${tone} ${shadowRing}`}
                  aria-hidden="true"
                />
              )}
              <span className="shrink-0 font-mono text-[11.5px] text-fg-faint tabular-nums">
                {row.id.slice(-7)}
              </span>
              <span className="min-w-0 truncate font-medium text-fg-strong">
                {row.model}
              </span>
              <span className="inline-flex h-[18px] shrink-0 items-center rounded-[3px] border border-hairline px-1.5 font-mono text-[10.5px] text-fg-faint">
                {row.pipeline}
              </span>
              {showEnvironment && <EnvTag environmentId={row.environmentId} />}
            </div>
            {!compact && (
              <span
                className={`text-right font-mono text-[11.5px] tabular-nums ${
                  active ? "text-warm" : "text-fg-strong"
                }`}
              >
                {formatCallMetric(row, nowMs)}
              </span>
            )}
            <span className="text-right font-mono text-[11.5px] tabular-nums text-fg">
              {row.costDisplay}
            </span>
            {!compact && (
              <span className="truncate text-right font-mono text-[11.5px] text-fg-faint">
                {row.signerLabel}
              </span>
            )}
            <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-faint">
              {formatRunRelativeTime(row.timestamp)}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
