"use client";

import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";
import EnvTag from "@/components/dashboard/EnvTag";
import EmptyState from "@/components/dashboard/EmptyState";
import StatusDot from "@/components/dashboard/StatusDot";
import { useTickWhileActive } from "@/components/dashboard/useTickWhileActive";
import { formatCallMetric, formatRunRelativeTime } from "@/lib/dashboard/utils";
import { MOCK_RECENT_REQUESTS } from "@/lib/dashboard/mock-data";
import type { AccountActivityStatus } from "@/lib/dashboard/types";

/**
 * ActivityPanel — the organization's own recent calls: the calls it made
 * across the network, which are what count toward its usage and spend. It's a
 * live preview of /usage. (Inbound traffic that other people send to this
 * org's public apps is *their* usage, not this org's, so it isn't shown here.)
 */

const STATUS_TONE: Record<AccountActivityStatus, string> = {
  active: "bg-warm",
  success: "bg-green-bright shadow-[0_0_0_2px_rgba(64,191,134,0.18)]",
  timeout: "bg-warm",
  failed: "bg-red-400",
};

const GRID =
  "grid items-center gap-3 px-5 grid-cols-[8px_minmax(0,1fr)_72px_64px] sm:grid-cols-[8px_minmax(0,1fr)_72px_72px_64px]";

export default function ActivityPanel() {
  // Live, in-progress sessions float to the top (stable sort keeps the rest
  // newest-first), then show the most recent dozen.
  const rows = [...MOCK_RECENT_REQUESTS]
    .sort(
      (a, b) =>
        (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1),
    )
    .slice(0, 12);

  const nowMs = useTickWhileActive(rows.some((r) => r.status === "active"));

  if (rows.length === 0) {
    return (
      <EmptyState
        variant="guided"
        icon={<Activity className="h-4 w-4" />}
        title="No activity yet"
        description="Calls your organization makes will stream here — what you ran, how it went, and what it cost."
        action={{ label: "Browse apps", href: "/" }}
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-dark-lighter shadow-card">
      <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold text-fg">Recent activity</h2>
          <p className="mt-0.5 font-mono text-[11.5px] tracking-[0.01em] text-fg-faint">
            calls you&apos;ve made
          </p>
        </div>
        <Link
          href="/usage"
          className="group inline-flex shrink-0 items-center gap-1 font-mono text-[11.5px] uppercase tracking-[0.04em] text-fg-faint transition-colors hover:text-fg"
        >
          View all
          <ArrowRight
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>

      <div
        className={`${GRID} border-b border-hairline bg-dark py-2 font-mono text-[10px] uppercase tracking-[0.07em] text-fg-disabled`}
      >
        <span aria-hidden="true" />
        <span>Call</span>
        <span className="hidden text-right sm:block">Elapsed</span>
        <span className="text-right">Cost</span>
        <span className="text-right">Time</span>
      </div>

      {rows.map((row, i) => (
        <Link
          key={row.id}
          href={`/usage?request=${row.id}`}
          className={`${GRID} py-2.5 transition-colors hover:bg-zebra ${
            i > 0 ? "border-t border-hairline" : ""
          }`}
        >
          {row.status === "active" ? (
            <StatusDot tone="warm" size="md" />
          ) : (
            <span
              className={`h-2 w-2 rounded-full ${STATUS_TONE[row.status]}`}
              aria-hidden="true"
            />
          )}
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-[12.5px] text-fg-strong">
              {row.model}
            </span>
            <EnvTag environmentId={row.environmentId} />
          </span>
          <span
            className={`hidden text-right font-mono text-[11.5px] tabular-nums sm:block ${
              row.status === "active" ? "text-warm" : "text-fg-strong"
            }`}
          >
            {formatCallMetric(row, nowMs)}
          </span>
          <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-strong">
            {row.costDisplay}
          </span>
          <span className="text-right font-mono text-[11.5px] tabular-nums text-fg-faint">
            {formatRunRelativeTime(row.timestamp)}
          </span>
        </Link>
      ))}
    </section>
  );
}
