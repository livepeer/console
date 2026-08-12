/**
 * Stacked-area chart — direct port of the Livepeer Dashboard design's
 * `StackedArea` (Apr 2026, `views.jsx` lines 7-69). Each layer is filled at
 * 0.45 opacity in its own color; the top stroke is green-bright to anchor the
 * silhouette. X-axis labels render at 5 evenly-spaced positions
 * (0, 25, 50, 75, 100% → days ago + "Today").
 */
export default function StackedAreaChart({
  series,
  colors,
  height = 180,
}: {
  series: { name: string; data: number[] }[];
  colors: string[];
  height?: number;
}) {
  const w = 720;
  const h = height;
  const padX = 8;
  const padTop = 8;
  const padBot = 22;

  const days = series[0].data.length;
  const stacks = series.map((s) => s.data);
  const totals = stacks[0].map((_, i) => stacks.reduce((a, s) => a + s[i], 0));
  const max = Math.max(...totals) * 1.1;

  const xAt = (i: number) => padX + (i / (days - 1)) * (w - padX * 2);
  const yAt = (v: number) => padTop + (1 - v / max) * (h - padTop - padBot);

  const layers: { d: string; color: string }[] = [];
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
    layers.push({ d: top + bot + "Z", color: colors[li] });
    prev = cum;
  }

  const topStroke = totals
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`
    )
    .join(" ");

  const ticks = [
    0,
    Math.floor(days / 4),
    Math.floor(days / 2),
    Math.floor((days * 3) / 4),
    days - 1,
  ];

  return (
    // Two-layer composition: the bottom SVG stretches to fill the container
    // (preserveAspectRatio="none") so the area paths span the full width,
    // and an HTML label overlay sits on top with no stretch — `<text>`
    // glyphs inside the stretched SVG were getting horizontally skewed
    // whenever the container exceeded the 720px viewBox width.
    <div className="relative" style={{ height: h }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="block"
      >
        <line
          x1={padX}
          x2={w - padX}
          y1={h - padBot}
          y2={h - padBot}
          stroke="var(--color-tint)"
        />
        {layers.map((l, i) => (
          <path key={i} d={l.d} fill={l.color} fillOpacity={0.45} />
        ))}
        <path d={topStroke} fill="none" stroke="#40BF86" strokeWidth="1.25" />
      </svg>
      {/* Tick labels — HTML overlay so they don't inherit the SVG's
          horizontal stretch. Each label centers on its tick's x position
          expressed as a percentage of the viewBox width. */}
      <div
        className="pointer-events-none absolute inset-x-0 font-mono text-[9px] text-fg-faint"
        style={{ bottom: 4 }}
        aria-hidden="true"
      >
        {ticks.map((i) => (
          <span
            key={i}
            className="absolute"
            style={{
              left: `${(xAt(i) / w) * 100}%`,
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {i === days - 1 ? "Today" : `${days - 1 - i}d`}
          </span>
        ))}
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
  const h = height;
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
  const gradId = `mini-spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: "block", width, height }}
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
