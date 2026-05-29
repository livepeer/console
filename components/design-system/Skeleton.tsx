type Variant = "text" | "card" | "circle" | "chart";

interface SkeletonProps {
  variant?: Variant;
  /** Width override — Tailwind class (e.g. "w-32") or any CSS length. Defaults vary per variant. */
  width?: string;
  /** Height override. Defaults vary per variant. */
  height?: string;
  className?: string;
}

const VARIANT_DEFAULTS: Record<Variant, { width: string; height: string; rounded: string }> = {
  text: { width: "w-full", height: "h-3.5", rounded: "rounded" },
  card: { width: "w-full", height: "h-24", rounded: "rounded-xl" },
  circle: { width: "w-8", height: "h-8", rounded: "rounded-full" },
  chart: { width: "w-full", height: "h-48", rounded: "rounded-lg" },
};

/**
 * Skeleton — unified loading placeholder.
 *
 * Uses the existing `shimmer` keyframe (defined in globals.css) for a quiet
 * highlight sweep that signals "loading" without being noisy. Pair multiple
 * Skeletons in a row to mimic the shape of the content being loaded.
 *
 * Variants:
 *  - `text`: thin line, default for body-text placeholders (use multiple stacked)
 *  - `card`: chunky block, for KPI cards / list items
 *  - `circle`: round, for avatars / icons
 *  - `chart`: tall block, for chart areas
 */
export default function Skeleton({
  variant = "text",
  width,
  height,
  className = "",
}: SkeletonProps) {
  const defaults = VARIANT_DEFAULTS[variant];
  const w = width ?? defaults.width;
  const h = height ?? defaults.height;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={`bg-white/[0.04] ${defaults.rounded} ${w} ${h} ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 2s linear infinite",
      }}
    >
      <span className="sr-only">Loading…</span>
    </div>
  );
}
