"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Stacked-area chart for usage (OpenMeter daily jobs). Supports Y-axis ticks,
 * horizontal grid lines, and per-day hover tooltips with series breakdown.
 */
function utcTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDayTick(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) {
    return "Today";
  }
  const todayMs = Date.parse(`${todayKey}T00:00:00.000Z`);
  const dayMs = Date.parse(`${dayKey}T00:00:00.000Z`);
  const daysAgo = Math.round((todayMs - dayMs) / 86_400_000);
  return `${daysAgo}d`;
}

function formatDayTooltipTitle(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) {
    return "Today";
  }
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Integer Y-axis ticks from 0 through a padded max. */
/**
 * Clean ticks from 0 through a padded max. Steps snap to 1/2/5 × 10^k so
 * dollar axes read 0 / 5 / 10 rather than 0 / 7 / 14, and sub-unit ranges
 * (a day of spend under $4) get 0.5 / 1 / 1.5 instead of collapsing to 0 / 1.
 */
function buildYTicks(maxValue: number, tickCount = 4): number[] {
  if (maxValue <= 0) {
    return [0];
  }
  const padded = maxValue * 1.1;
  const raw = padded / tickCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const step = nice * mag;
  const top = Math.ceil(padded / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  return ticks;
}

export default function StackedAreaChart({
  series,
  colors,
  dayKeys,
  height = 200,
  formatValue = (n) => n.toLocaleString("en-US"),
  unit = (n) => (n === 1 ? "job" : "jobs"),
  lineColor,
  breakdown,
}: {
  series: { name: string; data: number[] }[];
  colors: string[];
  dayKeys?: string[];
  height?: number;
  /** Axis ticks and tooltip values. Default: integer counts. */
  formatValue?: (n: number) => string;
  /** The word after the day's total in the tooltip. Default: job/jobs. */
  unit?: (n: number) => string;
  /** The top line. Defaults to the last series colour. */
  lineColor?: string;
  /**
   * Rows for the tooltip only — not plotted. Lets a single-series plot (one
   * wash, one line) still answer "which capability was that?" on hover
   * without stacking seven fills on the chart.
   */
  breakdown?: { name: string; data: number[]; color: string }[];
}) {
  const w = 720;
  const h = height;
  const padLeft = 44;
  const padRight = 10;
  const padTop = 10;
  const padBot = 24;
  const plotW = w - padLeft - padRight;

  const days = series[0]?.data.length ?? 0;
  const stacks = useMemo(() => series.map((s) => s.data), [series]);
  const totals = useMemo(() => {
    if (days <= 0) {
      return [] as number[];
    }
    return stacks[0].map((_, i) => stacks.reduce((a, s) => a + (s[i] ?? 0), 0));
  }, [stacks, days]);
  const maxValue = Math.max(...totals, 0);
  const yTicks = useMemo(() => buildYTicks(maxValue), [maxValue]);
  const yMax = yTicks[yTicks.length - 1] ?? 1;

  const xAt = useCallback(
    (i: number) =>
      days <= 1 ? padLeft + plotW / 2 : padLeft + (i / (days - 1)) * plotW,
    [days, plotW]
  );
  const yAt = useCallback(
    (v: number) => padTop + (1 - v / yMax) * (h - padTop - padBot),
    [yMax, h]
  );

  const todayKey = utcTodayKey();
  const labelKeys = useMemo(() => {
    if (dayKeys && dayKeys.length === days) {
      return dayKeys;
    }
    return Array.from({ length: days }, (_, i) => {
      const daysAgo = days - 1 - i;
      if (daysAgo === 0) {
        return todayKey;
      }
      const d = new Date(`${todayKey}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() - daysAgo);
      return d.toISOString().slice(0, 10);
    });
  }, [dayKeys, days, todayKey]);

  const layers = useMemo(() => {
    const result: { d: string; color: string }[] = [];
    let prev = new Array(days).fill(0);
    for (let li = 0; li < stacks.length; li++) {
      const cum = stacks[li].map((v, i) => prev[i] + v);
      let top = "";
      let bot = "";
      for (let i = 0; i < days; i++) {
        top += `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(cum[i]).toFixed(1)} `;
      }
      for (let i = days - 1; i >= 0; i--) {
        bot += `L${xAt(i).toFixed(1)},${yAt(prev[i]).toFixed(1)} `;
      }
      result.push({ d: top + bot + "Z", color: colors[li] });
      prev = cum;
    }
    return result;
  }, [stacks, colors, days, xAt, yAt]);

  const topStroke = useMemo(
    () =>
      totals
        .map(
          (v, i) =>
            `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`
        )
        .join(" "),
    [totals, xAt, yAt]
  );

  const xLabelTicks = useMemo(
    () => [
      0,
      Math.floor(days / 4),
      Math.floor(days / 2),
      Math.floor((days * 3) / 4),
      days - 1,
    ],
    [days]
  );

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // The one day that is a tab stop. Follows the active day so Tab-then-
  // Shift-Tab returns where you left; otherwise the most recent day, which
  // is the one a reader most often wants first.
  const [roving, setRoving] = useState<number | null>(null);

  // Rows under the day's total in the tooltip: the explicit breakdown when
  // given, else the plotted series themselves (only worth listing if there
  // is more than one).
  const tooltipRows = useMemo(
    () =>
      breakdown ??
      (series.length > 1
        ? series.map((s, si) => ({ ...s, color: colors[si] ?? "" }))
        : []),
    [breakdown, series, colors]
  );
  const plotRef = useRef<HTMLDivElement>(null);

  const resolveIndexFromClientX = useCallback(
    (clientX: number) => {
      const el = plotRef.current;
      if (!el || days <= 0) {
        return null;
      }
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      if (days === 1) {
        return 0;
      }
      return Math.round(ratio * (days - 1));
    },
    [days]
  );

  const activeIndex = hoverIndex;

  if (days === 0) {
    return (
      <p
        className="py-12 text-center text-sm text-fg-faint"
        style={{ height: h }}
      >
        No daily data for this period.
      </p>
    );
  }

  const tooltipLeftPct =
    activeIndex !== null && days > 1
      ? ((xAt(activeIndex) - padLeft) / plotW) * 100
      : activeIndex === 0
        ? 0
        : 50;

  return (
    <div className="relative select-none" style={{ height: h }}>
      {/* Y-axis labels (no horizontal stretch) */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between font-mono text-[9px] tabular-nums text-fg-faint"
        style={{
          width: padLeft - 4,
          paddingTop: padTop,
          paddingBottom: padBot,
        }}
        aria-hidden="true"
      >
        {[...yTicks].reverse().map((tick) => (
          <span key={tick} className="text-right leading-none">
            {formatValue(tick)}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        preserveAspectRatio="none"
        className="block"
        aria-hidden="true"
      >
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={padLeft}
            x2={w - padRight}
            y1={yAt(tick)}
            y2={yAt(tick)}
            stroke="var(--color-tint)"
            strokeOpacity={tick === 0 ? 1 : 0.65}
          />
        ))}
        {layers.map((l, i) => (
          <path key={i} d={l.d} fill={l.color} fillOpacity={0.12} />
        ))}
        <path
          d={topStroke}
          fill="none"
          stroke={
            lineColor ??
            colors[colors.length - 1] ??
            "var(--color-green-bright)"
          }
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {activeIndex !== null && (
          <>
            <line
              x1={xAt(activeIndex)}
              x2={xAt(activeIndex)}
              y1={padTop}
              y2={h - padBot}
              stroke="var(--color-fg-faint)"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity={0.85}
            />
            {stacks.map((stack, si) => {
              let cum = 0;
              for (let j = 0; j <= si; j++) {
                cum += stack[activeIndex] ?? 0;
              }
              if (cum <= 0) {
                return null;
              }
              return (
                <circle
                  key={si}
                  cx={xAt(activeIndex)}
                  cy={yAt(cum)}
                  r={3.5}
                  fill={colors[si]}
                  stroke="var(--color-dark-lighter)"
                  strokeWidth={2}
                />
              );
            })}
          </>
        )}
      </svg>

      {/* X-axis tick labels */}
      <div
        className="pointer-events-none absolute font-mono text-[9px] text-fg-faint"
        style={{
          left: padLeft,
          right: padRight,
          bottom: 4,
          height: 16,
        }}
        aria-hidden="true"
      >
        {xLabelTicks.map((i) => (
          <span
            key={i}
            className="absolute"
            style={{
              left: `${days <= 1 ? 50 : (i / (days - 1)) * 100}%`,
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {formatDayTick(labelKeys[i]!, todayKey)}
          </span>
        ))}
      </div>

      {/* Per-day hit targets + tooltip */}
      <div
        ref={plotRef}
        className="absolute"
        style={{
          left: `${(padLeft / w) * 100}%`,
          right: `${(padRight / w) * 100}%`,
          top: padTop,
          bottom: padBot,
        }}
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const idx = resolveIndexFromClientX(e.clientX);
          setHoverIndex(idx);
        }}
        // Keyboard: ONE tab stop enters the chart (roving tabindex — thirty
        // stops for thirty days was a Tab-key trap); ←/→ walk the days and
        // reveal the same tooltip hover does. Blur only clears when focus
        // leaves the plot entirely, so arrowing between days doesn't flicker.
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setHoverIndex(null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const cur = hoverIndex ?? (e.key === "ArrowRight" ? -1 : days);
          const next = Math.min(
            days - 1,
            Math.max(0, cur + (e.key === "ArrowRight" ? 1 : -1))
          );
          setHoverIndex(next);
          setRoving(next);
          (
            e.currentTarget.querySelectorAll("[data-day]")[next] as
              | HTMLElement
              | undefined
          )?.focus();
        }}
      >
        <div
          className="flex h-full w-full"
          role="group"
          aria-label="Spend by day"
        >
          {Array.from({ length: days }, (_, i) => (
            <div
              key={i}
              data-day={i}
              tabIndex={i === (roving ?? days - 1) ? 0 : -1}
              onFocus={() => {
                setHoverIndex(i);
                setRoving(i);
              }}
              className="h-full min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-bright/30"
              aria-label={`${formatDayTooltipTitle(labelKeys[i]!, todayKey)}: ${formatValue(totals[i]!)} ${unit(totals[i]!)}`}
            />
          ))}
        </div>

        {activeIndex !== null && (
          <div
            className="pointer-events-none absolute z-10 min-w-[148px] rounded-md border border-hairline bg-dark-card px-2.5 py-2 shadow-card"
            style={{
              left: `${Math.min(92, Math.max(8, tooltipLeftPct))}%`,
              bottom: "100%",
              marginBottom: 8,
              transform: "translateX(-50%)",
            }}
            role="tooltip"
          >
            <p className="font-mono text-[10px] font-medium text-fg">
              {formatDayTooltipTitle(labelKeys[activeIndex]!, todayKey)}
            </p>
            <p className="mt-0.5 font-mono text-[10px] tabular-nums text-fg-muted">
              <span className="text-fg-strong">
                {formatValue(totals[activeIndex]!)}
              </span>{" "}
              {unit(totals[activeIndex]!)}
            </p>
            {tooltipRows.length > 0 && (
              <ul className="mt-1.5 space-y-1 border-t border-hairline pt-1.5">
                {tooltipRows.map((s) => {
                  const count = s.data[activeIndex] ?? 0;
                  if (count <= 0) {
                    return null;
                  }
                  return (
                    <li
                      key={s.name}
                      className="flex items-center justify-between gap-3 font-mono text-[10px] tabular-nums"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-fg-muted">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
                          style={{ background: s.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{s.name}</span>
                      </span>
                      <span className="text-fg-strong">
                        {formatValue(count)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Generate a 60-day mock series with a realistic shape (drift + sine wave +
 * noise). Mirrors the design's `genSeries` helper. Stable across renders via
 * the caller's `useMemo`.
 */
export function genCapSeries(
  base: number,
  drift: number,
  noise: number,
  days = 30
): number[] {
  const arr: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = (days - 1 - i) / (days - 1);
    const v =
      base *
      (1 + t * (drift - 1)) *
      (1 + (Math.sin(i * 0.6) + Math.random() * 2 - 1) * noise * 0.3);
    arr.push(Math.max(0, v));
  }
  return arr;
}

/**
 * Inline single-series sparkline (line + soft area gradient). Used in dense
 * cells like the breakdown table's `Jobs · trend` column.
 */
export function MiniSpark({
  data,
  color = "#40BF86",
  height = 18,
  width = 70,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  const w = 100;
  const chartH = height;
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const r = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = chartH - ((v - min) / r) * (chartH - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `M0,${chartH} L${pts.replace(/ /g, " L")} L${w},${chartH} Z`;
  const gradId = `mini-spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  // `color` may be a `var(--color-series-N)`: presentation attributes don't
  // resolve custom properties, but `style` does.
  return (
    <svg
      viewBox={`0 0 ${w} ${chartH}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: "block", width, height }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: color }} stopOpacity="0.18" />
          <stop offset="1" style={{ stopColor: color }} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <polyline
        points={pts}
        fill="none"
        style={{ stroke: color }}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
