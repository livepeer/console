import type { ReactNode } from "react";

type Trend = "up" | "down" | "flat";

interface KpiCardProps {
  /** Small caps label rendered above the value. */
  label: string;
  /** The number/string headline. Renders in tabular-nums monospace. */
  value: string;
  /** Optional unit appended after the value (smaller, dim). */
  unit?: string;
  /** Optional trend delta string ("+12.4% vs last period") rendered in a chip. */
  delta?: string;
  /** Direction of the delta. Drives the chip color. Default `flat`. */
  trend?: Trend;
  /** Optional icon glyph rendered inline with the label. */
  icon?: ReactNode;
  /** Optional sparkline data — renders an inline SVG area chart on the right
   *  of the delta row. Quiet by default; uses the cell's accent color. */
  spark?: number[];
  /** Sparkline color. Defaults to green-bright. */
  sparkColor?: string;
}

const TREND_CLASS: Record<Trend, string> = {
  up: "text-green-bright bg-green/15",
  down: "text-green-bright bg-green/15",
  flat: "text-fg-faint bg-hover",
};

function Sparkline({ data, color = "#40bf86" }: { data: number[]; color?: string }) {
  const w = 100;
  const h = 22;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const r = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / r) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `M0,${h} L${pts.replace(/ /g, " L")} L${w},${h} Z`;
  const gradId = `spark-grad-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="block h-[22px] w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" />
    </svg>
  );
}

/**
 * KpiCard — single source of truth for stat cells in the bordered KpiStrip.
 *
 * Per the Livepeer Console design (Apr 2026): mono-uppercase label, large
 * mono value with an optional small unit, mono delta chip with an inline
 * sparkline beside it. No internal border — the surrounding KpiStrip provides
 * the divider rhythm.
 */
export default function KpiCard({
  label,
  value,
  unit,
  delta,
  trend = "flat",
  icon,
  spark,
  sparkColor,
}: KpiCardProps) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3.5">
      <p className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-fg-faint">
        {icon && <span className="text-fg-faint">{icon}</span>}
        {label}
      </p>
      <p className="flex items-baseline gap-1 text-[26px] font-semibold leading-normal tabular-nums tracking-[-0.02em] text-fg">
        <span>{value}</span>
        {unit && <span className="text-[12px] font-normal text-fg-faint">{unit}</span>}
      </p>
      {(delta || spark) && (
        <div className="flex items-center justify-between gap-3">
          {delta ? (
            <span
              className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-[3px] px-1.5 py-0.5 font-mono text-[11px] tabular-nums ${TREND_CLASS[trend]}`}
            >
              {delta}
            </span>
          ) : (
            <span />
          )}
          {spark && (
            <div className="ml-auto max-w-[80px] flex-1">
              <Sparkline data={spark} color={sparkColor} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
