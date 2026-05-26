"use client";

import { useState, useMemo, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import StatCard from "./StatCard";
import KpiStrip from "@/components/dashboard/KpiStrip";
import PeriodToggle from "./PeriodToggle";
import { StackedChartTooltip } from "./ChartTooltip";
import {
  NETWORK_STATS,
  API_REQUEST_SERIES,
  TOP_APIS,
  API_COLORS,
  MODELS,
} from "@/lib/dashboard/mock-data";
import {
  computeAxisTicks,
  formatRuns,
  generateSparklineData,
  getModelIcon,
} from "@/lib/dashboard/utils";
import Link from "next/link";
import type { NetworkStat } from "@/lib/dashboard/types";

// ─── KPI subset for overview ───

const OVERVIEW_KPI: NetworkStat[] = [
  NETWORK_STATS[3], // Requests / sec
  NETWORK_STATS[6], // Success Rate
  NETWORK_STATS[7], // Total GPUs
  NETWORK_STATS[2], // Median Latency
];

// ─── Time period filter ───

type Period = "7d" | "30d" | "3m";

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "3m", label: "3M" },
];

function filterByPeriod<T extends { date: string }>(data: T[], period: Period): T[] {
  const now = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return data.filter((d) => new Date(d.date) >= cutoff);
}

// ─── Top Pipelines grid ───

function TopPipelinesGrid() {
  const sorted = useMemo(
    () =>
      [...MODELS]
        .sort((a, b) => b.runs7d - a.runs7d)
        .slice(0, 9),
    [],
  );

  const othersRuns = MODELS
    .sort((a, b) => b.runs7d - a.runs7d)
    .slice(9)
    .reduce((s, m) => s + m.runs7d, 0);

  const totalRuns = MODELS.reduce((s, m) => s + m.runs7d, 0);

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3.5">
        <div>
          <p className="text-[17px] font-bold text-fg">Top pipelines</p>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            By request volume · last 3 months
          </p>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 border-b border-hairline px-4 py-2">
        <span className="w-5" />
        <span className="w-7" />
        <span className="min-w-0 flex-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-disabled">Pipeline</span>
        <span className="hidden w-12 shrink-0 text-right font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-disabled sm:block">Share</span>
        <span className="w-16 shrink-0 text-right font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-disabled">Requests</span>
      </div>

      <div className="divide-y divide-[var(--color-border-hairline)]">
        {sorted.map((model, i) => {
          const Icon = getModelIcon(model.category);
          const color = API_COLORS[i % API_COLORS.length];
          const pct = ((model.runs7d / totalRuns) * 100).toFixed(1);
          return (
            <Link
              key={model.id}
              href={`/dashboard/models/${model.id}`}
              className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zebra"
            >
              <span className="w-5 text-right text-[11px] text-fg-disabled">
                {i + 1}
              </span>
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color }} />
              </div>
              <p className="min-w-0 flex-1 truncate text-sm text-fg-strong">
                {model.name}
              </p>
              <span className="hidden w-12 shrink-0 text-right text-[11px] text-fg-faint sm:block">
                {pct}%
              </span>
              <span className="w-16 shrink-0 text-right text-xs text-fg-strong">
                {formatRuns(model.runs7d)}
              </span>
            </Link>
          );
        })}
        {othersRuns > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-5 text-right text-[11px] text-fg-label">+</span>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-hover">
              <span className="text-xs text-fg-label">...</span>
            </div>
            <p className="min-w-0 flex-1 text-sm text-fg-muted">Others</p>
            <span className="hidden w-12 shrink-0 text-right text-[11px] text-fg-label sm:block">
              {((othersRuns / totalRuns) * 100).toFixed(1)}%
            </span>
            <span className="w-16 shrink-0 text-right text-xs text-fg-muted">
              {formatRuns(othersRuns)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ───

export default function OverviewTab() {
  const [period, setPeriod] = useState<Period>("3m");
  const chartData = useMemo(() => filterByPeriod(API_REQUEST_SERIES, period), [period]);
  const xTicks = useMemo(() => computeAxisTicks(chartData, "date", 6), [chartData]);

  // Compute total requests from chart data
  const totalRequests = useMemo(() => {
    let sum = 0;
    for (const row of chartData) {
      for (const key of Object.keys(row)) {
        if (key !== "date" && typeof row[key] === "number") sum += row[key] as number;
      }
    }
    return sum;
  }, [chartData]);

  // Stable per-stat sparkline series so each KPI reads as a chart cell, not a
  // bare number. Generated client-side only — `generateSparklineData` uses
  // `Math.random()`, which would mismatch between SSR and hydration if it
  // ran inside `useMemo`. Empty array on first paint; sparklines render
  // after mount.
  const [kpiSparks, setKpiSparks] = useState<number[][]>([]);
  useEffect(() => {
    setKpiSparks(OVERVIEW_KPI.map(() => generateSparklineData(20)));
  }, []);
  const kpiSparkColors = [
    "var(--chart-1)",
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-7 px-7 pt-7 pb-20">
      {/* No in-tab section header — the page chrome (`Network · Live state of
          the open GPU network…`) and the active tab pill ("Overview") already
          identify the section. Repeating the title in the tab body adds noise
          without adding signal — same pattern as `/dashboard/usage`. */}

      {/* KPI cards — 4 metrics with sparklines so each cell reads as
          monitoring, not just static figures. */}
      <KpiStrip cols={4}>
        {OVERVIEW_KPI.map((stat, i) => (
          <StatCard
            key={stat.label}
            stat={stat}
            spark={kpiSparks[i]}
            sparkColor={kpiSparkColors[i]}
          />
        ))}
      </KpiStrip>

      {/* Total Requests panel — chart card with mono eyebrow + headline KPI
          on the left, period toggle pinned to the right. Mirrors the Home
          view's "Your overview" / hero KPI rhythm. */}
      <div className="rounded-md border border-hairline bg-dark-lighter shadow-card px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-faint">
              Total requests
            </p>
            <p className="mt-1.5 font-mono text-[28px] font-semibold leading-[1.05] tracking-[-0.02em] tabular-nums text-fg">
              {(totalRequests / 1_000_000).toFixed(1)}M
            </p>
            <p className="mt-1 text-[12px] text-fg-muted">
              Total inference requests across all APIs on the network.
            </p>
          </div>
          <PeriodToggle value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        </div>

        <div className="mt-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barCategoryGap="15%">
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--color-fg-label)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => v.slice(5)}
                ticks={xTicks}
                interval={0}
                padding={{ left: 8, right: 8 }}
              />
              <YAxis hide />
              <Tooltip content={<StackedChartTooltip />} cursor={{ fill: "var(--color-zebra)" }} />
              {TOP_APIS.map((api, i) => (
                <Bar
                  key={api}
                  dataKey={api}
                  stackId="requests"
                  fill={API_COLORS[i]}
                  radius={i === TOP_APIS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3">
          {TOP_APIS.map((api, i) => (
            <div key={api} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: API_COLORS[i] }}
              />
              <span className="text-[11px] text-fg-faint">{api}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Pipelines grid */}
      <TopPipelinesGrid />
    </div>
  );
}
