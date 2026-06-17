"use client";

import { useEnvironment } from "@/components/dashboard/EnvironmentContext";

export type PageScope = "environment" | "all-environments";

/**
 * ScopeChip — a small indicator that answers one consistent question in the
 * page header: *which environment's data am I looking at?* This is how the
 * first-principles IA conveys scope — the nav is a flat task list, the
 * switchers set context, and each page states its own environment coverage
 * here, where it actually matters (when you're on the page).
 *
 *  - "environment" → the active environment's name + colored dot (green =
 *    production, blue = development). Page data is scoped to this one
 *    environment.
 *  - "all-environments" → "All environments". The page aggregates across every
 *    environment in the organization (e.g. Usage: one bill, one free-tier pool).
 *
 * Network-wide pages (Explore, Stats) render no chip — they aren't about your
 * environments at all.
 */
export default function ScopeChip({ scope }: { scope: PageScope }) {
  const { selectedEnvironment } = useEnvironment();

  if (scope === "all-environments") {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-dark-card px-2 py-px text-[11px] text-fg-faint"
        title="Aggregates across every environment in this organization"
      >
        All environments
      </span>
    );
  }

  const isProd = selectedEnvironment.kind === "production";
  const accent = isProd
    ? "var(--color-green-bright)"
    : "var(--color-blue-bright)";

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-px text-[11px]"
      style={{
        background: `color-mix(in oklab, ${accent} 10%, transparent)`,
        borderColor: `color-mix(in oklab, ${accent} 28%, transparent)`,
        color: accent,
      }}
      title={`Scoped to the ${selectedEnvironment.name} environment`}
    >
      <span
        className="h-[5px] w-[5px] rounded-full"
        style={{ background: accent }}
        aria-hidden="true"
      />
      {selectedEnvironment.name}
    </span>
  );
}
