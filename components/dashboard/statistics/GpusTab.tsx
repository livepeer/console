"use client";

import { useState, useMemo, useRef, useLayoutEffect, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import StatCard from "./StatCard";
import KpiStrip from "@/components/dashboard/KpiStrip";
import { StackedChartTooltip, SimpleChartTooltip } from "./ChartTooltip";
import { GPU_NODES, GPU_GROWTH } from "@/lib/dashboard/mock-data";
import { computeAxisTicks, generateSparklineData } from "@/lib/dashboard/utils";
import type { NetworkStat } from "@/lib/dashboard/types";

// ─── Constants ───
//
// Chart palette tokens — defined once in `globals.css` (`--chart-1..10`).
// Using `var()` here means light/dark or any future theme retune flows
// through without touching this file.
const GPU_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
];

// Short label for bar segments — the unique model identifier
function gpuShortName(name: string): string {
  // Extract the most recognizable short identifier
  const n = name.replace("NVIDIA ", "");
  if (n.startsWith("H100")) return "H100";
  if (n.startsWith("A100")) return "A100";
  if (n.startsWith("A10G")) return "A10G";
  if (n.includes("A6000")) return "A6000";
  if (n.includes("6000")) return "6000";
  if (n.includes("4090")) return "4090";
  if (n.includes("3090")) return "3090";
  if (n.startsWith("L40")) return "L40";
  if (n.startsWith("L4")) return "L4";
  return n.split(" ")[0];
}

// Sorted by count descending, "Other" always last
const GPU_TYPE_KEYS = (() => {
  const latest = GPU_GROWTH[GPU_GROWTH.length - 1];
  if (!latest?.byType) return ["H100", "A100", "A6000", "RTX 4090", "L40", "Other"];
  return Object.entries(latest.byType)
    .filter(([k]) => k !== "Other")
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k)
    .concat("Other");
})();

// ─── Main ───

export default function GpusTab() {
  const [chartMode, setChartMode] = useState<"total" | "byType">("total");

  const barRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tooltipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [tooltipShifts, setTooltipShifts] = useState<number[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Close popover when tapping outside the bar (mobile tap-to-reveal)
  useEffect(() => {
    if (openIndex === null) return;
    const handleClick = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openIndex]);

  const totalGpus = useMemo(() => GPU_NODES.reduce((s, n) => s + n.count, 0), []);
  const totalVram = useMemo(() => {
    // Extract numeric GB from memory strings like "141 GB HBM3e"
    return GPU_NODES.reduce((s, n) => {
      const gb = parseFloat(n.memory);
      return s + (isNaN(gb) ? 0 : gb * n.count);
    }, 0);
  }, []);
  const gpuGrowthTicks = useMemo(() => computeAxisTicks(GPU_GROWTH, "date", 6), []);
  const latestGrowth = GPU_GROWTH[GPU_GROWTH.length - 1];
  const earliestGrowth = GPU_GROWTH[0];
  const growthPct = (
    ((latestGrowth.total - earliestGrowth.total) / earliestGrowth.total) * 100
  ).toFixed(1);

  const kpi: NetworkStat[] = useMemo(() => [
    { label: "Total GPUs", value: totalGpus.toLocaleString(), delta: `+${growthPct}%`, trend: "up" as const },
    { label: "GPU Types", value: `${GPU_NODES.length}`, trend: "flat" as const },
    { label: "Total VRAM", value: `${(totalVram / 1000).toFixed(0)} TB`, trend: "flat" as const },
    { label: "90D Growth", value: `${growthPct}%`, delta: `+${latestGrowth.total - earliestGrowth.total}`, trend: "up" as const },
  ], [totalGpus, totalVram, growthPct, latestGrowth.total, earliestGrowth.total]);

  // Mock sparklines for the 4 GPU KPIs — generated client-side only since
  // `generateSparklineData` uses `Math.random()` (would mismatch SSR/hydration
  // if run inside useMemo).
  const [kpiSparks, setKpiSparks] = useState<number[][]>([]);
  useEffect(() => {
    setKpiSparks(kpi.map(() => generateSparklineData(20)));
  }, [kpi]);
  const kpiSparkColors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-1)",
    "var(--chart-1)",
  ];

  // Compute per-segment tooltip shift so each tooltip stays centered on its
  // segment unless that would clip the bar's left/right edge, in which case
  // shift just enough to remain in view.
  useLayoutEffect(() => {
    const compute = () => {
      const bar = barRef.current;
      if (!bar) return;
      const barRect = bar.getBoundingClientRect();
      const next = GPU_NODES.map((_, i) => {
        const seg = segmentRefs.current[i];
        const tip = tooltipRefs.current[i];
        if (!seg || !tip) return 0;
        const segRect = seg.getBoundingClientRect();
        const tipW = tip.offsetWidth;
        const center = segRect.left + segRect.width / 2;
        const tipLeft = center - tipW / 2;
        const tipRight = center + tipW / 2;
        if (tipLeft < barRect.left) return barRect.left - tipLeft;
        if (tipRight > barRect.right) return barRect.right - tipRight;
        return 0;
      });
      setTooltipShifts((prev) =>
        prev.length === next.length && prev.every((v, i) => v === next[i])
          ? prev
          : next,
      );
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (barRef.current) ro.observe(barRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-7 px-7 pt-7 pb-20">
      {/* No in-tab section header — page chrome + active tab pill identify
          the section. */}

      {/* KPI cards — sparklines per stat so the cells read as monitoring,
          not just static figures. */}
      <KpiStrip cols={4}>
        {kpi.map((stat, i) => (
          <StatCard
            key={stat.label}
            stat={stat}
            spark={kpiSparks[i]}
            sparkColor={kpiSparkColors[i]}
          />
        ))}
      </KpiStrip>

      {/* Growth chart */}
      <div className="rounded-md border border-hairline bg-dark-lighter shadow-card px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-faint">
              GPU growth
            </p>
            <p className="mt-1.5 font-mono text-[28px] font-semibold leading-[1.05] tracking-[-0.02em] tabular-nums text-fg">
              {latestGrowth.total.toLocaleString()}
            </p>
            <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-green-bright">
              <TrendingUp className="h-3 w-3" />
              <span className="tabular-nums">{growthPct}%</span>
              <span className="text-fg-muted"> · last 90 days</span>
            </div>
          </div>

          {/* Mode toggle — uses the same shape as PeriodToggle for visual
              parity with the other tabs' chart cards. */}
          <div
            className="flex h-[26px] shrink-0 items-center rounded-[4px] border border-hairline bg-dark-lighter p-0.5"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={chartMode === "total"}
              onClick={() => setChartMode("total")}
              className={`flex h-5 items-center rounded-[3px] px-2 text-[11.5px] font-medium transition-colors ${
                chartMode === "total"
                  ? "bg-pop text-fg"
                  : "text-fg-faint hover:text-fg-strong"
              }`}
            >
              Total
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={chartMode === "byType"}
              onClick={() => setChartMode("byType")}
              className={`flex h-5 items-center rounded-[3px] px-2 text-[11.5px] font-medium transition-colors ${
                chartMode === "byType"
                  ? "bg-pop text-fg"
                  : "text-fg-faint hover:text-fg-strong"
              }`}
            >
              By type
            </button>
          </div>
        </div>

        <div className="mt-4" />

        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={GPU_GROWTH}>
            <defs>
              <linearGradient id="gpuTotalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              {chartMode === "byType" &&
                GPU_TYPE_KEYS.map((key, i) => (
                  <linearGradient key={key} id={`gpuFill-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GPU_COLORS[i]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={GPU_COLORS[i]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--color-fg-label)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => v.slice(5)}
              ticks={gpuGrowthTicks}
              interval={0}
              padding={{ left: 8, right: 8 }}
            />
            <YAxis hide />
            {chartMode === "total" ? (
              <>
                <Tooltip content={<SimpleChartTooltip formatValue={(v) => `${v.toLocaleString()} GPUs`} />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#gpuTotalFill)"
                />
              </>
            ) : (
              <>
                <Tooltip content={<StackedChartTooltip />} />
                {GPU_TYPE_KEYS.map((key, i) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={`byType.${key}`}
                    name={key}
                    stackId="gpu"
                    stroke={GPU_COLORS[i]}
                    strokeWidth={1}
                    fill={`url(#gpuFill-${i})`}
                  />
                ))}
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Legend — only renders when By Type is active (no reserved slot) */}
        {chartMode === "byType" && (
          <div className="mt-3 flex flex-wrap gap-3">
            {GPU_TYPE_KEYS.map((key, i) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: GPU_COLORS[i] }}
                />
                <span className="text-[11px] text-fg-faint">{key}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GPU Inventory — mix bar + table in one card */}
      <div className="overflow-x-clip rounded-md border border-hairline bg-dark-lighter shadow-card">
        <div className="border-b border-hairline px-4 py-3.5">
          <p className="text-[17px] font-bold text-fg">GPU inventory</p>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            Current GPU types on the network with hardware specifications
          </p>
        </div>

        {/* GPU Mix bar — inline above table */}
        <div className="relative border-b border-hairline px-4 py-4">
          <div ref={barRef} className="flex h-10 gap-[1px] rounded-lg">
            {GPU_NODES.map((node, i) => {
              const pct = (node.count / totalGpus) * 100;
              const isFirst = i === 0;
              const isLast = i === GPU_NODES.length - 1;
              const shift = tooltipShifts[i] ?? 0;
              const isOpen = openIndex === i;
              return (
                <div
                  key={node.name}
                  ref={(el) => {
                    segmentRefs.current[i] = el;
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  aria-label={`${node.name}: ${node.count} GPUs, ${pct.toFixed(1)}%`}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenIndex(isOpen ? null : i);
                    }
                  }}
                  className={`group relative flex cursor-pointer items-center justify-center transition-opacity hover:opacity-100 ${isOpen ? "opacity-100" : ""}`}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: GPU_COLORS[i % GPU_COLORS.length],
                    opacity: isOpen ? 1 : 0.75,
                    borderRadius: isFirst && isLast ? "0.5rem" : isFirst ? "0.5rem 0 0 0.5rem" : isLast ? "0 0.5rem 0.5rem 0" : undefined,
                  }}
                >
                  {pct > 3 && (
                    <span className="truncate px-0.5 text-[9px] font-medium text-fg">
                      {gpuShortName(node.name)}
                    </span>
                  )}
                  {/* Popover — hover on desktop, tap-to-toggle on mobile.
                      Centered on segment, shifted only if it would clip the
                      bar's left/right edge. */}
                  <div
                    ref={(el) => {
                      tooltipRefs.current[i] = el;
                    }}
                    className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 rounded-lg border border-hairline bg-dark-card px-3 py-2 transition-opacity ${isOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    style={{
                      transform: `translateX(calc(-50% + ${shift}px))`,
                    }}
                  >
                    <p className="whitespace-nowrap text-xs font-medium text-fg">{node.name}</p>
                    <p className="mt-0.5 whitespace-nowrap text-[11px] text-fg-faint">
                      {node.count} GPUs · {pct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-disabled">
          <span className="flex-1 pl-[18px]">GPU name</span>
          <span className="w-14 text-right">Count</span>
          <span className="w-12 text-right">Share</span>
          <span className="hidden w-24 text-right sm:block">Memory</span>
          <span className="hidden w-16 text-right md:block">TFLOPS</span>
          <span className="hidden w-16 text-right lg:block">Power</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[var(--color-border-hairline)]">
          {GPU_NODES.map((node, i) => {
            const pct = ((node.count / totalGpus) * 100).toFixed(1);
            return (
              <div key={node.name} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex flex-1 items-center gap-2 text-sm text-fg-strong">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: GPU_COLORS[i % GPU_COLORS.length] }}
                  />
                  <span className="truncate">{node.name}</span>
                </span>
                <span className="w-14 text-right text-sm font-medium text-fg">
                  {node.count}
                </span>
                <span className="w-12 text-right text-[11px] text-fg-disabled">
                  {pct}%
                </span>
                <span className="hidden w-24 text-right text-xs text-fg-faint sm:block">
                  {node.memory}
                </span>
                <span className="hidden w-16 text-right text-xs text-fg-faint md:block">
                  {node.tflops}
                </span>
                <span className="hidden w-16 text-right text-xs text-fg-faint lg:block">
                  {node.maxPower}
                </span>
              </div>
            );
          })}
        </div>

        {/* Total row */}
        <div className="flex items-center gap-3 border-t border-subtle bg-zebra px-4 py-2.5">
          <span className="flex-1 text-sm font-medium text-fg-muted">Total</span>
          <span className="w-14 text-right text-sm font-semibold text-fg">
            {totalGpus.toLocaleString()}
          </span>
          <span className="w-12 text-right text-[11px] text-fg-disabled">100%</span>
          <span className="hidden w-24 text-right text-xs text-fg-label sm:block">
            {(totalVram / 1000).toFixed(0)} TB
          </span>
          <span className="hidden w-16 md:block" />
          <span className="hidden w-16 lg:block" />
        </div>
      </div>
    </div>
  );
}
