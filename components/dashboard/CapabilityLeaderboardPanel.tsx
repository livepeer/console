"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from "lucide-react";

/**
 * CapabilityLeaderboardPanel — the home view's bottom panel.
 *
 * Replaces the previous "stacked-area Usage by capability" + "Pinned
 * capabilities" two-column grid. Per the v5 prototype's
 * `capability-usage.jsx`: a flat sortable leaderboard answering "what's
 * costing me money / growing / dropping" instead of just "look at this
 * 30-day chart of run counts." Columns:
 *
 *   dot · capability + share · 30d sparkline · runs (30d) · Δ vs prior ·
 *   p95 · spend share (mono number + bar)
 *
 * Sortable by runs / delta / p95 / spend. Video capabilities render as a
 * group at the top, other capabilities below — matching the prototype's
 * `videoCaps` / `otherCaps` split.
 */

type SortKey = "runs" | "delta" | "p95" | "spend";

interface CapRow {
  id: string;
  name: string;
  group: "video" | "other";
  color: string;
  /** 30-day sparkline data — one entry per day. */
  data: number[];
  /** Total 30d runs, derived from the per-day distribution. */
  runs: number;
  /** Prior 30d runs, used to compute `delta`. */
  prior: number;
  delta: number;
  spend: number;
  /** p95 latency in ms. */
  p95: number;
}

// Per-app mock shapes — the org's top apps by volume. Kept inline so this
// component is the single source of truth for the home leaderboard. When real
// telemetry lands, replace `useCapabilityData` with a hook that fetches the
// same shape, ranking the org's apps by runs.
const SHAPES = [
  { id: "frameworks-transcoding", name: "Frameworks Transcoding", group: "video", color: "#18794E", runs30: 248_600, prior30: 212_400, spend:    149.16, p95:  64, growth: 1.32, noise: 0.14 },
  { id: "daydream-video",         name: "Daydream Video API",     group: "video", color: "#40BF86", runs30: 184_200, prior30: 142_600, spend: 1_840.20, p95: 142, growth: 1.7,  noise: 0.18 },
  { id: "stable-video-diffusion", name: "Stable Video Diffusion", group: "video", color: "#1E9960", runs30:  62_400, prior30:  41_800, spend:    624.00, p95: 188, growth: 1.85, noise: 0.22 },
  { id: "live-portrait",          name: "LivePortrait",           group: "video", color: "#25ABD0", runs30:   8_400, prior30:   6_100, spend:     84.00, p95: 290, growth: 1.56, noise: 0.45 },
  { id: "llama-3-70b",            name: "Llama 3 70B",            group: "other", color: "#f97373", runs30: 142_800, prior30: 110_200, spend:    214.20, p95: 880, growth: 1.45, noise: 0.14 },
  { id: "flux-schnell",           name: "FLUX.1 [schnell]",       group: "other", color: "#a78bfa", runs30:  96_400, prior30: 102_100, spend:    482.00, p95: 612, growth: 0.92, noise: 0.22 },
  { id: "whisper-v3",             name: "Whisper v3 Large",       group: "other", color: "#fbbf24", runs30:  41_600, prior30:  47_300, spend:    124.80, p95: 460, growth: 0.84, noise: 0.30 },
] as const;

// Build the 30-day distribution by combining a linear trend and two sine
// wobbles, then normalizing to total `runs30`. Mirrors the prototype's
// `useCapabilityData` exactly so the leaderboard reads as the same panel.
function useCapabilityData(): CapRow[] {
  return useMemo(() => {
    const N = 30;
    return SHAPES.map((s) => {
      const seed = s.id.length * 7;
      const arr: number[] = [];
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const trend = 1 + (s.growth - 1) * t;
        const wobble =
          Math.sin((i + seed) * 0.7) * 0.6 +
          Math.sin((i + seed) * 0.21) * 0.4;
        const v = trend * (1 + wobble * s.noise);
        arr.push(Math.max(0.05, v));
      }
      const sum = arr.reduce((a, x) => a + x, 0);
      const data = arr.map((v) => Math.round((v / sum) * s.runs30));
      const runs = data.reduce((a, x) => a + x, 0);
      const delta = (s.runs30 - s.prior30) / s.prior30;
      return {
        id: s.id,
        name: s.name,
        group: s.group,
        color: s.color,
        data,
        runs,
        prior: s.prior30,
        delta,
        spend: s.spend,
        p95: s.p95,
      };
    });
  }, []);
}

function MiniSpark({
  data,
  color = "#40BF86",
  width = 120,
  height = 28,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...data, 0.0001);
  const min = Math.min(...data);
  const range = Math.max(max - min, 0.0001);
  const xAt = (i: number) => (i / (data.length - 1)) * width;
  const yAt = (v: number) => height - 2 - ((v - min) / range) * (height - 4);
  const linePath = data
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`,
    )
    .join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      style={{ display: "block", maxWidth: 130 }}
      aria-hidden="true"
    >
      <path d={areaPath} fill={color} fillOpacity={0.12} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatRuns(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

function SortHead({
  label,
  k,
  active,
  right,
  onSort,
}: {
  label: string;
  k: SortKey;
  active: boolean;
  right?: boolean;
  onSort: (k: SortKey) => void;
}) {
  const Icon: LucideIcon = ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className={`inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.06em] transition-colors hover:text-fg-strong focus:outline-none ${
        active ? "text-fg-muted" : "text-fg-disabled"
      } ${right ? "justify-end" : ""}`}
    >
      <span>{label}</span>
      {active && <Icon className="h-2.5 w-2.5" aria-hidden="true" />}
    </button>
  );
}

export default function CapabilityLeaderboardPanel() {
  const caps = useCapabilityData();
  const [sort, setSort] = useState<SortKey>("runs");

  const totalRuns = caps.reduce((a, c) => a + c.runs, 0);
  const totalSpend = caps.reduce((a, c) => a + c.spend, 0);

  const sorted = [...caps].sort((a, b) => {
    if (sort === "runs") return b.runs - a.runs;
    if (sort === "spend") return b.spend - a.spend;
    if (sort === "delta") return b.delta - a.delta;
    if (sort === "p95") return b.p95 - a.p95;
    return 0;
  });
  const videoCaps = sorted.filter((c) => c.group === "video");
  const otherCaps = sorted.filter((c) => c.group !== "video");

  // Shared grid template — keeps the head row aligned with the body rows.
  // Mirrors the prototype's `.cap-lb-head, .cap-lb-row { grid-template-columns: 14px 1.6fr 140px 0.9fr 0.9fr 0.7fr 1.2fr; }`.
  const cols =
    "grid items-center gap-3.5 px-4 grid-cols-[14px_minmax(0,1.6fr)_140px_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,1.2fr)]";

  const Row = ({ c }: { c: CapRow }) => {
    const runsShare = c.runs / totalRuns;
    const spendShare = c.spend / totalSpend;
    const up = c.delta >= 0;
    const Arrow = up ? ArrowUp : ArrowDown;
    return (
      <div
        className={`${cols} cursor-default border-t border-hairline py-2.5 transition-colors hover:bg-zebra`}
      >
        <span
          className="h-2 w-2 rounded-[2px]"
          style={{ background: c.color }}
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-col gap-px">
          <span className="truncate text-[13px] font-medium text-fg">
            {c.name}
          </span>
          <span className="font-mono text-[10.5px] text-fg-faint">
            {(runsShare * 100).toFixed(0)}% of calls
          </span>
        </div>
        <div className="flex items-center">
          <MiniSpark data={c.data} color={c.color} width={120} height={28} />
        </div>
        <span className="text-right font-mono text-[12.5px] tabular-nums text-fg-strong">
          {formatRuns(c.runs)}
        </span>
        <span
          className={`inline-flex items-center justify-end gap-1 font-mono text-[12.5px] tabular-nums ${
            up ? "text-green-bright" : "text-red-400"
          }`}
        >
          <Arrow className="h-2.5 w-2.5" aria-hidden="true" />
          {up ? "+" : ""}
          {(c.delta * 100).toFixed(0)}%
        </span>
        <span className="text-right font-mono text-[12.5px] tabular-nums text-fg-strong">
          {c.p95}
          <span className="text-fg-disabled">ms</span>
        </span>
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-[12.5px] tabular-nums text-fg-strong">
            ${c.spend.toFixed(0)}
          </span>
          <span className="block h-1 w-full max-w-[140px] overflow-hidden rounded-[2px] bg-tint">
            <span
              className="block h-full rounded-[2px] opacity-80"
              style={{
                width: `${(spendShare * 100).toFixed(2)}%`,
                background: c.color,
              }}
            />
          </span>
        </div>
      </div>
    );
  };

  return (
    <section className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
      {/* Panel head — title + sub on the left, "View usage" link on the right. */}
      <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3.5">
        <div>
          <p className="text-[17px] font-bold text-fg">
            Usage by app
          </p>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            Last 30 days · sorted by volume
          </p>
        </div>
        <Link
          href="/usage"
          className="inline-flex items-center gap-1 text-[12px] text-fg-faint transition-colors hover:text-fg"
        >
          View usage <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {/* Column header strip — shares the row grid template */}
      <div
        className={`${cols} bg-dark py-2.5 text-fg-disabled`}
      >
        <span aria-hidden="true" />
        <SortHead
          label="App"
          k="runs"
          active={sort === "runs"}
          onSort={setSort}
        />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled">
          30d trend
        </span>
        <SortHead
          label="Calls (30d)"
          k="runs"
          active={sort === "runs"}
          right
          onSort={setSort}
        />
        <SortHead
          label="Δ vs prior"
          k="delta"
          active={sort === "delta"}
          right
          onSort={setSort}
        />
        <SortHead
          label="p95"
          k="p95"
          active={sort === "p95"}
          right
          onSort={setSort}
        />
        <SortHead
          label="Spend share"
          k="spend"
          active={sort === "spend"}
          right
          onSort={setSort}
        />
      </div>

      {/* Body — video group first, then other (per the prototype's split). */}
      <div>
        {videoCaps.map((c) => (
          <Row key={c.id} c={c} />
        ))}
        {otherCaps.map((c) => (
          <Row key={c.id} c={c} />
        ))}
      </div>
    </section>
  );
}
