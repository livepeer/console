"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import StatusDot from "@/components/dashboard/StatusDot";
import { getOrgFleet, formatCompact } from "@/lib/dashboard/org-fleet";
import type { Pipeline, PipelineStatusKind } from "@/lib/dashboard/types";

/**
 * AppsHealthPanel — "Your apps": the org's deployed apps with health AND
 * traffic in one table (an app's traffic IS its usage, so there's no separate
 * "health" vs "usage by app" split). Each row carries a status-colored edge bar and an
 * inline calls-trend sparkline, so "is it up, is it busy" reads in a glance.
 * Anything needing attention (error → building) sorts to the top and is tinted.
 * Self-hides for a consumer-only org with no deployed apps.
 */

const STATUS_META: Record<
  PipelineStatusKind,
  {
    label: string;
    dot: "green" | "amber" | "red" | "blue";
    /** Edge-bar + sparkline accent (Tailwind text/bg utility fragments). */
    bar: string;
    spark: string;
    /** Attention tint behind the whole row, or "" for none. */
    tint: string;
    rank: number;
  }
> = {
  error: {
    label: "Error",
    dot: "red",
    bar: "bg-red-400",
    spark: "text-red-400",
    tint: "bg-red-400/[0.045]",
    rank: 0,
  },
  building: {
    label: "Building",
    dot: "amber",
    bar: "bg-warm",
    spark: "text-warm",
    tint: "bg-warm/[0.045]",
    rank: 1,
  },
  deployed: {
    label: "Deployed",
    dot: "green",
    bar: "bg-green-bright",
    spark: "text-green-bright",
    tint: "",
    rank: 2,
  },
  stopped: {
    label: "Stopped",
    dot: "blue",
    bar: "bg-blue-bright",
    spark: "text-fg-disabled",
    tint: "",
    rank: 3,
  },
};

// Deterministic per-app sparkline — seeded by id so it's stable across renders
// (no Math.random → no hydration drift) and shaped by status: healthy apps
// trend gently up, errored apps sag, building apps are flat-and-new.
function seededSpark(seed: string, status: PipelineStatusKind): number[] {
  const n = 18;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = (h ^ seed.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  const drift = status === "error" ? -1.4 : status === "deployed" ? 0.9 : 0;
  const out: number[] = [];
  let v = status === "building" ? 12 : 50;
  for (let i = 0; i < n; i++) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const noise = ((h % 1000) / 1000 - 0.5) * 22;
    v = Math.max(6, Math.min(94, v + noise + drift));
    out.push(v);
  }
  return out;
}

function Sparkline({ data, className }: { data: number[]; className: string }) {
  const w = 72;
  const hgt = 22;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const r = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = hgt - ((v - min) / r) * (hgt - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${hgt}`}
      preserveAspectRatio="none"
      className={`h-[22px] w-[72px] ${className}`}
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Responsive: on mobile only name · calls · p50 fit, so Status and Trend
// collapse (the colored edge bar still carries status). The hidden cells are
// display:none below `sm`, so they drop out of grid flow and the 3-track
// template lines up — matching the cells marked `hidden sm:*` below.
const GRID =
  "grid items-center gap-3 pl-5 pr-4 grid-cols-[minmax(0,1fr)_84px_52px] sm:grid-cols-[minmax(0,1fr)_104px_76px_84px_56px]";

export default function AppsHealthPanel() {
  const { apps, count, totalCalls7d } = getOrgFleet();
  if (apps.length === 0) return null;

  // Attention first (error → building), then by traffic. The page opens on
  // whatever matters most.
  const sorted = [...apps].sort(
    (a, b) =>
      STATUS_META[a.status].rank - STATUS_META[b.status].rank ||
      b.calls7d - a.calls7d,
  );

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-dark-lighter shadow-card">
      <div className="border-b border-hairline px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-fg">Deployed apps</h2>
          <Link
            href="/apps"
            className="group inline-flex shrink-0 items-center gap-1 font-mono text-[11.5px] uppercase tracking-[0.04em] text-fg-faint transition-colors hover:text-fg"
          >
            All apps
            <ArrowRight
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>

        {/* Hero is the app count (the title is a count-noun, so the big number
            must agree with it). Calls served — a public count, like package
            downloads — sits as the right-aligned secondary, mirroring Usage. */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-[22px] font-semibold leading-none tabular-nums tracking-[-0.01em] text-fg">
            {count}
          </span>
          <span className="font-mono text-[12px] text-fg-faint">
            {count === 1 ? "app" : "apps"}
          </span>
          <span className="ml-auto font-mono text-[11px] tabular-nums text-fg-faint">
            {formatCompact(totalCalls7d)} calls · 7d
          </span>
        </div>
      </div>

      <div
        className={`${GRID} border-b border-hairline bg-dark py-2 font-mono text-[10px] uppercase tracking-[0.07em] text-fg-disabled`}
      >
        <span>App</span>
        <span className="hidden sm:block">Status</span>
        <span className="hidden sm:block">Trend</span>
        <span className="text-right">Calls · 7d</span>
        <span className="text-right">p50</span>
      </div>

      {sorted.map((a: Pipeline, i) => {
        const s = STATUS_META[a.status];
        return (
          <Link
            key={a.id}
            href={`/apps/${a.id}?tab=overview`}
            className={`group relative ${GRID} py-3 transition-colors hover:bg-zebra ${
              i > 0 ? "border-t border-hairline" : ""
            } ${s.tint}`}
          >
            {/* Status edge bar — ambient health signal down the left rail. */}
            <span
              className={`absolute inset-y-0 left-0 w-[2.5px] ${s.bar}`}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium text-fg">
                {a.name}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[11px] text-fg-faint">
                {a.pipelineId}
              </span>
            </span>
            <span className="hidden items-center gap-1.5 text-[12.5px] text-fg-strong sm:inline-flex">
              <StatusDot tone={s.dot} static={a.status !== "deployed"} />
              {s.label}
            </span>
            <span
              className={`hidden sm:block ${a.calls7d > 0 ? s.spark : "text-fg-disabled"}`}
            >
              <Sparkline data={seededSpark(a.id, a.status)} className="" />
            </span>
            <span className="text-right font-mono text-[12.5px] tabular-nums text-fg-strong">
              {formatCompact(a.calls7d)}
            </span>
            <span className="text-right font-mono text-[12.5px] tabular-nums text-fg-strong">
              {a.p50LatencyMs > 0 ? `${a.p50LatencyMs}ms` : "—"}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
