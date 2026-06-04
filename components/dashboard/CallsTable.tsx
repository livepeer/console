"use client";

import Link from "next/link";
import { formatCallMetric, formatRunRelativeTime } from "@/lib/dashboard/utils";
import EnvTag from "@/components/dashboard/EnvTag";
import StatusDot from "@/components/dashboard/StatusDot";
import { useTickWhileActive } from "@/components/dashboard/useTickWhileActive";
import type { AccountActivityRow } from "@/lib/dashboard/types";

/**
 * CallsTable — the single Linear-style call list, used by:
 *   1. the standalone /calls view
 *   2. the app-detail Logs tab (filtered to one app)
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
  className?: string;
}

export default function CallsTable({
  rows,
  showHeader = false,
  bordered = true,
  density = "compact",
  showEnvironment = false,
  className,
}: CallsTableProps) {
  // Static class strings — Tailwind's JIT can't resolve interpolated arbitrary
  // values, so each density preset is spelled out in full.
  const cols =
    density === "cozy"
      ? "grid items-center gap-3 px-5 grid-cols-[8px_minmax(0,1fr)_80px_80px_80px_80px]"
      : "grid items-center gap-3 px-4 grid-cols-[8px_minmax(0,1fr)_70px_70px_70px_70px]";
  const rowPadY = density === "cozy" ? "py-2" : "py-[7px]";

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
          className={`${cols} border-b border-hairline bg-dark py-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled`}
        >
          <span aria-hidden="true" />
          <span>Call</span>
          <span className="text-right">{metricLabel}</span>
          <span className="text-right">Cost</span>
          <span className="text-right">Via</span>
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
            href={`/calls?request=${row.id}`}
            className={`${cols} ${rowPadY} text-[12.5px] transition-colors hover:bg-hover ${
              i > 0 || showHeader ? "border-t border-hairline" : ""
            }`}
          >
            {active ? (
              // Liveness pulse for an in-progress session (warm per the
              // liveness color convention).
              <StatusDot tone="warm" size="md" />
            ) : (
              <span
                className={`h-2 w-2 rounded-full ${tone} ${shadowRing}`}
                aria-hidden="true"
              />
            )}
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
              {showEnvironment && <EnvTag environmentId={row.environmentId} />}
            </div>
            <span
              className={`text-right font-mono text-[11.5px] tabular-nums ${
                active ? "text-warm" : "text-fg-strong"
              }`}
            >
              {formatCallMetric(row, nowMs)}
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
