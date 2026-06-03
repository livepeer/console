"use client";

import { useMemo } from "react";
import Link from "next/link";
import StackedAreaChart, {
  MiniSpark,
  genCapSeries,
} from "@/components/dashboard/StackedAreaChart";

// Usage is an organization-level view: one free-tier pool and one bill span all
// environments (matching Modal, which keeps "Usage & Billing" at its workspace
// tier with no environment selector). Per-environment activity lives on the
// env-scoped Jobs page instead.

/**
 * UsageView — full Usage page body per the Livepeer Dashboard design v3
 * (Apr 2026, `usage-view.jsx`). Single horizontal free-tier strip + a stacked
 * "Jobs by capability" chart + a per-capability breakdown table (with delta vs
 * prior period and inline sparklines) + a Limits panel.
 *
 * Mocks 60 days of per-capability data so we can compute "this period vs prior
 * period" without flicker. The forecast tick on the bar projects from the
 * trailing 7-day average over the days remaining in the current period.
 */

const FREE_LIMIT = 10_000;
const FREE_USED = 8_796;
const DAYS_LEFT_IN_PERIOD = 6;
const PERIOD_LABEL = "30 days";
const PERIOD_DAYS = 30;
const RESETS_AT = "May 1";

type Capability = {
  id: string;
  name: string;
  unit: string;
  price: number;
  color: string;
  base: number;
  drift: number;
  noise: number;
};

// Per-capability colors picked at matched lightness/chroma so no one swatch
// dominates the legend (per Linear dashboard best practices §2).
const CAPABILITIES: Capability[] = [
  { id: "daydream",  name: "Daydream Video",      unit: "sec",  price: 0.012,   color: "#4ade80", base: 180, drift: 1.8, noise: 0.3 },
  { id: "transcode", name: "Livepeer Transcode",  unit: "min",  price: 0.0006,  color: "#38bdf8", base: 120, drift: 1.4, noise: 0.3 },
  { id: "flux",      name: "FLUX [schnell]",      unit: "img",  price: 0.003,   color: "#a78bfa", base: 80,  drift: 1.6, noise: 0.4 },
  { id: "whisper",   name: "Whisper v3",          unit: "min",  price: 0.001,   color: "#fb923c", base: 40,  drift: 1.2, noise: 0.5 },
  { id: "sdxl",      name: "SDXL Turbo",          unit: "img",  price: 0.002,   color: "#f472b6", base: 22,  drift: 1.1, noise: 0.6 },
];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
function fmtSpend(n: number): string {
  return `$${n.toFixed(2)}`;
}

// ── Free-tier strip ─────────────────────────────────────────────────────────

function UsageStrip({
  used,
  forecast,
  willExceed,
  daysToLimit,
  priorPeriodTotal,
  periodDelta,
}: {
  used: number;
  forecast: number;
  willExceed: boolean;
  daysToLimit: number;
  priorPeriodTotal: number;
  periodDelta: number;
}) {
  const left = FREE_LIMIT - used;
  const pct = Math.min(100, (used / FREE_LIMIT) * 100);
  const forecastPct = Math.min(100, (forecast / FREE_LIMIT) * 100);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-hairline bg-dark-lighter shadow-card px-5 py-4">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-faint">
        Free tier
      </p>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-[15px] tabular-nums leading-none text-fg-muted">
          <b className="mr-0.5 text-[24px] font-medium tracking-[-0.01em] text-fg">
            {fmt(used)}
          </b>
          <span className="text-fg-faint"> / {fmt(FREE_LIMIT)} calls</span>
        </span>
        <span className="ml-auto font-mono text-[11.5px] text-fg-faint">
          resets {RESETS_AT}
        </span>
      </div>

      {/* Bar with forecast tick */}
      <div className="relative h-1.5 rounded-[3px] bg-dark-card">
        <div
          className="h-full rounded-[3px] bg-gradient-to-r from-green to-green-bright"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute -top-0.5 -bottom-0.5 w-px"
          style={{
            left: `${forecastPct}%`,
            background: "rgba(251,191,36,0.55)",
            transform: "translateX(-0.5px)",
          }}
          title={`Forecast ${fmt(forecast)} by ${RESETS_AT}`}
          aria-hidden="true"
        >
          <span
            className="absolute -top-1 h-1 w-1 rounded-full"
            style={{
              left: -1.5,
              right: -1.5,
              background: "rgba(251,191,36,0.7)",
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-4 text-[12px] text-fg-muted">
        {willExceed ? (
          <span className="font-mono">
            Forecast{" "}
            <b className="font-medium text-fg">{fmt(forecast)}</b>
            {" "}by {RESETS_AT} · over limit in{" "}
            <b className="font-medium text-warm">~{daysToLimit}d</b>
          </span>
        ) : (
          <span className="font-mono">
            <b className="font-medium text-fg">{fmt(left)}</b> calls left ·
            pace looks fine.
          </span>
        )}
        <span className="font-mono text-[11.5px] text-fg-faint">
          Last period {fmt(priorPeriodTotal)} ·{" "}
          {periodDelta >= 0 ? "+" : ""}
          {periodDelta.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

export default function UsageView({
  weight = 1,
  filterName = "all environments",
}: {
  /** Consumption scale for the active environment filter (1 = all envs). */
  weight?: number;
  /** Display name of the active filter, for the subtitle. */
  filterName?: string;
}) {
  const freeUsed = Math.round(FREE_USED * weight);

  // 60-day series, scaled by the environment filter. Stable per (mount, weight)
  // via useMemo — random noise mustn't flicker between renders, but the series
  // re-scales when the filter changes.
  const caps = useMemo(
    () =>
      CAPABILITIES.map((c) => ({
        ...c,
        data60: genCapSeries(c.base * weight, c.drift, c.noise, 60),
      })),
    [weight],
  );

  const sliced = caps.map((c) => ({
    ...c,
    data: c.data60.slice(-PERIOD_DAYS),
    prior: c.data60.slice(-PERIOD_DAYS * 2, -PERIOD_DAYS),
  }));

  const totals = sliced.map((c) => {
    const sum = c.data.reduce((a, b) => a + b, 0);
    const priorSum = c.prior.reduce((a, b) => a + b, 0);
    const delta = priorSum > 0 ? ((sum - priorSum) / priorSum) * 100 : 0;
    return { ...c, sum, priorSum, delta, spend: sum * c.price };
  });
  const grandReq = totals.reduce((a, c) => a + c.sum, 0);
  const grandSpend = totals.reduce((a, c) => a + c.spend, 0);
  const totalsByDay = sliced[0].data.map((_, i) =>
    sliced.reduce((a, c) => a + c.data[i], 0),
  );
  const priorTotalsByDay = sliced[0].prior.map((_, i) =>
    sliced.reduce((a, c) => a + c.prior[i], 0),
  );
  const priorPeriodTotal = Math.round(
    priorTotalsByDay.reduce((a, b) => a + b, 0),
  );
  const periodDelta =
    priorPeriodTotal > 0
      ? ((freeUsed - priorPeriodTotal) / priorPeriodTotal) * 100
      : 0;

  // Forecast: trailing 7-day average × days remaining in period
  const last7Avg =
    totalsByDay.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const forecast = Math.round(freeUsed + last7Avg * DAYS_LEFT_IN_PERIOD);
  const willExceed = forecast > FREE_LIMIT;
  const left = FREE_LIMIT - freeUsed;
  const daysToLimit =
    left > 0 && last7Avg > 0 ? Math.max(0, Math.floor(left / last7Avg)) : 0;

  // Breakdown table — sorted descending by total runs
  const sortedTotals = [...totals].sort((a, b) => b.sum - a.sum);

  // Limits — same shape as design
  const limits: {
    label: string;
    used: number;
    max: number;
    fmt: (v: number) => string;
  }[] = [
    {
      label: "Calls / month",
      used: freeUsed,
      max: FREE_LIMIT,
      fmt: (v) => v.toLocaleString("en-US"),
    },
    {
      label: "Concurrent streams",
      used: 2,
      max: 3,
      fmt: (v) => String(v),
    },
    {
      label: "Max video duration",
      used: 4,
      max: 5,
      fmt: (v) => `${v} min`,
    },
    {
      label: "Storage retained",
      used: 1.2,
      max: 5,
      fmt: (v) => `${v} GB`,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-7 pb-20 pt-7">
      {/* Title — scope (Organization) is shown by the header chip. */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">
          Usage
        </h1>
        <p className="mt-1.5 text-[12.5px] text-fg-muted">
          Free-tier quota and spend
          {weight === 1 ? " across all environments" : ` in ${filterName}`}. For
          a per-environment breakdown, see your{" "}
          <Link
            href="/calls"
            className="text-fg-strong underline decoration-transparent underline-offset-2 hover:decoration-current"
          >
            calls
          </Link>
          .
        </p>
      </div>

      {/* Free-tier strip */}
      <UsageStrip
        used={freeUsed}
        forecast={forecast}
        willExceed={willExceed}
        daysToLimit={daysToLimit}
        priorPeriodTotal={priorPeriodTotal}
        periodDelta={periodDelta}
      />

      {/* Jobs by capability — stacked area */}
      <div className="mt-4 overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3.5">
          <div>
            <p className="text-[17px] font-bold text-fg">
              Activity by app
            </p>
            <p className="mt-0.5 text-[12px] text-fg-muted">
              Last {PERIOD_LABEL.toLowerCase()} · {fmt(grandReq)} calls
            </p>
          </div>
          <div className="flex flex-wrap gap-3.5 justify-end text-[11.5px] text-fg-muted">
            {sortedTotals.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5"
              >
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{ background: c.color }}
                  aria-hidden="true"
                />
                {c.name}
              </span>
            ))}
          </div>
        </div>
        <div className="px-3 pt-2 pb-1">
          <StackedAreaChart
            series={sliced.map((c) => ({ name: c.name, data: c.data }))}
            colors={sliced.map((c) => c.color)}
          />
        </div>
      </div>

      {/* Breakdown table */}
      <div className="mt-7 mb-2.5 flex items-center gap-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-fg-faint">
          Breakdown
        </span>
        <span className="rounded-full border border-hairline bg-dark-card px-1.5 py-px font-mono text-[10.5px] text-fg-faint">
          {totals.length}
        </span>
      </div>
      <BreakdownTable
        rows={sortedTotals}
        grandReq={grandReq}
        grandSpend={grandSpend}
      />

      {/* Limits */}
      <div className="mt-4 overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3.5">
          <div>
            <p className="text-[17px] font-bold text-fg">Limits</p>
            <p className="mt-0.5 text-[12px] text-fg-muted">
              Free tier defaults · raise after adding payment
            </p>
          </div>
          <Link
            href="/settings?tab=billing"
            className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-hairline bg-dark-card px-2.5 text-[12px] text-fg-strong transition-colors hover:border-subtle hover:text-fg"
          >
            Compare plans
          </Link>
        </div>
        <div className="py-1">
          {limits.map((l) => {
            const pct = Math.min(100, (l.used / l.max) * 100);
            const overWarn = pct > 80;
            return (
              <div
                key={l.label}
                className="border-b border-hairline px-4 py-2.5 last:border-b-0"
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-fg-strong">{l.label}</span>
                  <span className="font-mono text-[12px] tabular-nums text-fg-faint">
                    <b className="font-medium text-fg">{l.fmt(l.used)}</b>
                    <span className="text-fg-disabled"> / {l.fmt(l.max)}</span>
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-[2px] bg-dark-card">
                  <div
                    className="h-full rounded-[2px]"
                    style={{
                      width: `${pct}%`,
                      background: overWarn ? "#fbbf24" : "#40bf86",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Breakdown table ─────────────────────────────────────────────────────────

function BreakdownTable({
  rows,
  grandReq,
  grandSpend,
}: {
  rows: (Capability & {
    sum: number;
    delta: number;
    spend: number;
    data: number[];
  })[];
  grandReq: number;
  grandSpend: number;
}) {
  // grid: Capability | Jobs · trend (sparkline) | Δ vs prior | Share | Unit price | Spend
  const cols =
    "grid grid-cols-[1.7fr_1.5fr_0.7fr_0.7fr_1fr_0.9fr] items-center gap-2 px-4";

  const deltaColor = (d: number) => {
    if (d > 25) return "#fbbf24";
    if (d > 0) return "var(--color-fg-strong)";
    if (d < -10) return "#94a3b8";
    return "var(--color-fg-muted)";
  };

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      {/* Head */}
      <div
        className={`${cols} border-b border-hairline bg-dark py-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled`}
      >
        <div>App</div>
        <div className="justify-self-end">Calls · trend</div>
        <div className="justify-self-end">Δ vs prior</div>
        <div className="justify-self-end">Share</div>
        <div className="justify-self-end">Unit price</div>
        <div className="justify-self-end">Spend</div>
      </div>

      {/* Rows */}
      {rows.map((c) => {
        const share = (c.sum / grandReq) * 100;
        const dUp = c.delta > 0;
        return (
          <div
            key={c.id}
            className={`${cols} border-b border-hairline py-2.5 text-[13px] text-fg-strong transition-colors last:border-b-0 hover:bg-zebra`}
          >
            {/* Capability */}
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: c.color }}
                aria-hidden="true"
              />
              <Link
                href={`/calls?capability=${c.id}`}
                className="truncate text-fg underline decoration-transparent decoration-1 underline-offset-[3px] transition-colors hover:text-green-bright hover:decoration-current"
              >
                {c.name}
              </Link>
            </div>

            {/* Jobs · trend (number + inline sparkline) */}
            <div className="flex items-center justify-end gap-2.5">
              <span className="font-mono tabular-nums text-fg-strong">
                {fmt(c.sum)}
              </span>
              <span className="opacity-85">
                <MiniSpark
                  data={c.data}
                  color={c.color}
                  height={18}
                  width={70}
                />
              </span>
            </div>

            {/* Δ vs prior */}
            <div
              className="justify-self-end font-mono tabular-nums"
              style={{ color: deltaColor(c.delta) }}
            >
              {dUp ? "+" : ""}
              {c.delta.toFixed(0)}%
            </div>

            {/* Share */}
            <div className="justify-self-end font-mono tabular-nums text-fg-faint">
              {share.toFixed(1)}%
            </div>

            {/* Unit price */}
            <div className="justify-self-end font-mono tabular-nums text-fg-faint">
              ${c.price.toFixed(4)}
              <span className="text-fg-disabled"> /{c.unit}</span>
            </div>

            {/* Spend */}
            <div className="justify-self-end font-mono tabular-nums text-fg">
              {fmtSpend(c.spend)}
            </div>
          </div>
        );
      })}

      {/* Total */}
      <div
        className={`${cols} bg-dark py-2.5 text-[13px] font-medium text-fg-strong`}
      >
        <div className="text-fg-strong">
          Total
          <span className="ml-1.5 text-[11px] text-fg-faint">
            · this period
          </span>
        </div>
        <div className="justify-self-end font-mono tabular-nums text-fg">
          {fmt(grandReq)}
        </div>
        <div />
        <div />
        <div />
        <div className="justify-self-end font-mono tabular-nums text-fg">
          {fmtSpend(grandSpend)}
        </div>
      </div>
    </div>
  );
}
