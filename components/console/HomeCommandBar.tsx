"use client";

/**
 * HomeCommandBar — the page masthead.
 *
 *   flipbook                                                   ← system readout
 *   Good morning, adamsoffer                                   ← human greeting
 *
 * Plain and quiet: the org slug as a terminal title-bar line, then a warm
 * sans-serif greeting. (The operator attention line — erroring/building apps —
 * lives in the stacked apps PR, not here.)
 */
export default function HomeCommandBar({
  organization,
  firstName,
}: {
  organization: string;
  firstName: string;
}) {
  const orgSlug = organization.toLowerCase();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <header>
      {/* System readout — the terminal title-bar line. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] tracking-[0.02em] text-fg-faint">
        <span className="text-fg-strong">{orgSlug}</span>
      </div>

      {/* Greeting — the only sans-serif line up here, for warmth. */}
      <h1 className="mt-2.5 text-[28px] font-bold leading-[1.05] tracking-[-0.02em] text-fg">
        {greeting}, {firstName}
      </h1>
    </header>
  );
}
