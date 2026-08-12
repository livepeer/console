import type { ReactNode } from "react";

type Tone = "live" | "warm" | "cold" | "default" | "fail";

interface PillProps {
  /** Tone — drives color treatment. `live` (green, pulsing dot), `warm` (amber),
   *  `cold` (faint), `default` (neutral), `fail` (red). */
  tone?: Tone;
  /** Render the leading colored dot. Default `true`. */
  dot?: boolean;
  children: ReactNode;
}

const TONE_CLASSES: Record<Tone, { wrap: string; dot: string; pulse: boolean }> = {
  live: {
    wrap: "border-green-bright/30 bg-green/15 text-green-bright",
    dot: "bg-green-bright",
    pulse: true,
  },
  warm: {
    wrap: "border-warm/20 bg-warm/[0.08] text-warm",
    dot: "bg-warm",
    pulse: false,
  },
  cold: {
    wrap: "border-hairline bg-transparent text-fg-faint",
    dot: "bg-fg-faint",
    pulse: false,
  },
  default: {
    wrap: "border-hairline bg-transparent text-fg-strong",
    dot: "bg-fg-faint",
    pulse: false,
  },
  fail: {
    wrap: "border-red-400/30 bg-red-400/10 text-red-400",
    dot: "bg-red-400",
    pulse: false,
  },
};

/**
 * Pill — small status indicator with optional leading dot.
 *
 * Per the Livepeer Console design (Apr 2026): mono lowercase, 10.5px,
 * 1px outset ring, optional leading colored dot. The `live` tone pulses
 * to signal real-time activity. Used for capability status (live / warm /
 * cold), run status (success / fail / timeout), and similar.
 */
export default function Pill({ tone = "default", dot = true, children }: PillProps) {
  const t = TONE_CLASSES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10.5px] lowercase tracking-[0.02em] ${t.wrap}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot} ${
            t.pulse ? "motion-safe:animate-breathe" : ""
          }`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
