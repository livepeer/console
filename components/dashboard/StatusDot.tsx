type Tone = "green" | "warm" | "blue" | "red" | "amber";

interface StatusDotProps {
  /** Color tone — drives both the halo and center dot. Default `green`. */
  tone?: Tone;
  /** Visual size. `sm` (1.5px center, default), `md` (2px center). */
  size?: "sm" | "md";
  /** Disable the breathing halo animation (e.g. for in-grid icons that don't need motion). */
  static?: boolean;
  /** ARIA label for screen readers; only set when the dot conveys non-redundant meaning. */
  ariaLabel?: string;
}

const TONE_BG: Record<Tone, string> = {
  green: "bg-green-bright",
  warm: "bg-warm",
  blue: "bg-blue-bright",
  red: "bg-red-400",
  amber: "bg-amber-400",
};

/**
 * StatusDot — branded status indicator with a halo + center pattern.
 *
 * The halo expands and fades using the `statusHalo` keyframe (defined in
 * globals.css), which is smoother and slower than Tailwind's default
 * `animate-ping`. Pair with a static center dot of the same color.
 *
 * Drop-in replacement for the `<span class="relative flex h-1.5 w-1.5">…</span>`
 * pattern used in `NetworkStatusDot`, `ModelCard`, model-detail pill, etc.
 */
export default function StatusDot({
  tone = "green",
  size = "sm",
  static: isStatic = false,
  ariaLabel,
}: StatusDotProps) {
  const dim = size === "md" ? "h-2 w-2" : "h-1.5 w-1.5";
  const colorBg = TONE_BG[tone];

  return (
    <span
      className={`relative inline-flex shrink-0 ${dim}`}
      aria-label={ariaLabel}
      role={ariaLabel ? "status" : undefined}
    >
      {!isStatic && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${colorBg} animate-status-halo motion-reduce:animate-none motion-reduce:opacity-50`}
          aria-hidden="true"
        />
      )}
      <span
        className={`relative inline-flex rounded-full ${dim} ${colorBg}`}
        aria-hidden="true"
      />
    </span>
  );
}
