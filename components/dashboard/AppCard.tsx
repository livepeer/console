"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getAppIcon, formatRuns, isModelNew } from "@/lib/dashboard/utils";
import { generateCardBackground } from "@/lib/dashboard/generate-card-visual";
import StarButton from "@/components/dashboard/StarButton";
import Pill from "@/components/dashboard/Pill";
import type { App } from "@/lib/dashboard/types";

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

// Map verbose mock-data units ("Minute", "Request", etc.) to the short
// forms used in the design prototype's `cap-card-stat-val` (`/min`, `/req`,
// `/sec`, `/img`, `/tok`). Keeps the price cell narrow enough to fit
// alongside p50 + 7d-runs in the 3-column stats footer.
function shortUnit(unit: string): string {
  const map: Record<string, string> = {
    Minute: "min",
    Second: "sec",
    Request: "req",
    Step: "step",
    Image: "img",
    "M Tokens": "M tok",
  };
  return map[unit] ?? unit.toLowerCase();
}

function formatUnitPrice(model: App): {
  amount: string;
  unit: string;
} {
  const p = model.pricing.amount;
  return {
    amount: `$${p.toFixed(3)}`,
    unit: `/${shortUnit(model.pricing.unit)}`,
  };
}

/**
 * AppCard — capability card per the Livepeer Dashboard design v3
 * (Apr 2026, `.cap-card-*` in styles.css).
 *
 * Structure: 16:10 thumbnail with a backdrop-blur category chip pinned to the
 * bottom-left, then a body with name + warm/cold status pill, vendor, two-line
 * description (with reserved height so cards line up), and a three-column
 * stats footer (p50 latency, unit price, 7-day runs) separated by a hairline.
 *
 * Star (top-right, hover-reveal) and NEW (top-left, when applicable) badges
 * are preserved on top of the v3 chrome since they're working production
 * affordances on this surface.
 */
export default function AppCard({
  model,
  hideNewBadge = false,
  href,
  tag,
}: {
  model: App;
  /** Starred / recently-viewed contexts already imply discovery — the NEW badge reads as noise there. */
  hideNewBadge?: boolean;
  /** Link target override. Defaults to the model-detail route; published pipelines pass their /apps/[id]. */
  href?: string;
  /** Optional small badge on the thumbnail (e.g. "Pipeline" for community-published apps). */
  tag?: string;
}) {
  const Icon = getAppIcon(model.category);
  const isWarm = model.status === "hot";
  const isNew = isModelNew(model) && !hideNewBadge;
  const price = formatUnitPrice(model);

  return (
    <Link
      href={href ?? `/apps/${model.id}`}
      className="group flex flex-col overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card transition-[colors,transform] duration-150 ease-out hover:-translate-y-[1px] hover:border-strong"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-dark-card">
        {model.coverImage ? (
          <img
            src={model.coverImage}
            alt={`${model.name} by ${model.provider}`}
            loading="lazy"
            className="block h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: generateCardBackground(model.id) }}
            aria-hidden="true"
          >
            <Icon
              className="h-7 w-7 text-fg-faint"
              strokeWidth={1.5}
            />
          </div>
        )}

        {/* Pipeline/community tag — top-left. Marks an Explore card that is a
            user-published pipeline rather than a first-party network model. */}
        {tag && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md border border-green-bright/30 bg-dark-card/80 px-1.5 py-0.5 text-[10.5px] font-medium text-green-bright backdrop-blur">
            {tag}
          </span>
        )}

        {/* NEW badge — top-left, only when the model is fresh */}
        {!tag && isNew && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-green-bright px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-950">
            <Sparkles className="h-2.5 w-2.5" strokeWidth={2.25} />
            new
          </span>
        )}

        {/* Category chip — backdrop-blurred, bottom-left of the thumbnail */}
        <span
          className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-[4px] py-[3px] pr-[7px] pl-[6px] text-[10.5px] font-medium text-white/90"
          style={{
            background: "rgba(10, 10, 11, 0.72)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {model.category}
        </span>

        {/* Star — top-right, hover-reveal */}
        <StarButton modelId={model.id} className="absolute top-2 right-2" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 px-3.5 pt-3 pb-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.005em] text-fg">
            {model.name}
          </span>
          <Pill tone={isWarm ? "warm" : "cold"} dot>
            {isWarm ? "warm" : "cold"}
          </Pill>
        </div>

        <p className="-mt-1 text-[12.5px] text-fg-faint">{model.provider}</p>

        <p
          className="text-[13px] leading-[1.45] text-fg-muted"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            // Reserved height = 3 × 13px × 1.45 ≈ 57px so cards line up
            // even when descriptions are short (1- or 2-line copy still
            // takes the full 3-line slot, keeping stats footers aligned
            // across the grid).
            minHeight: 57,
          }}
        >
          {model.description}
        </p>

        {/* Stats footer — 3 columns, hairline divider above. Matches the
         *  design prototype's `.cap-card-stat-val` pattern: label is the
         *  plain noun ("Price"), value pairs the amount with a dimmed
         *  unit shorthand (`$0.005/min`). Keeping the unit short (3-letter
         *  abbreviations via `shortUnit`) lets `$0.005/min` fit cleanly in
         *  1/3 column width without truncating. */}
        <div className="mt-[2px] grid grid-cols-3 gap-2 border-t border-hairline pt-2.5">
          <Stat label="p50" value={formatLatency(model.latency)} />
          <Stat
            label="Price"
            value={
              <>
                {price.amount}
                <span className="text-fg-faint">{price.unit}</span>
              </>
            }
          />
          <Stat label="7d calls" value={formatRuns(model.runs7d)} />
        </div>
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-fg-faint">
        {label}
      </span>
      <span className="truncate font-mono text-[12px] tabular-nums text-fg-strong">
        {value}
      </span>
    </div>
  );
}
