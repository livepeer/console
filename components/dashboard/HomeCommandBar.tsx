"use client";

import Link from "next/link";
import { ArrowRight, TriangleAlert, Loader } from "lucide-react";
import StatusDot from "@/components/dashboard/StatusDot";
import { getOrgFleet } from "@/lib/dashboard/org-fleet";

/**
 * HomeCommandBar — the page masthead, styled as an operations-console readout.
 *
 *   flipbook · 7 deployments                                  ← system readout
 *   Good morning, adamsoffer                                  ← human greeting
 *   ⚠ Live Transcribe is erroring — 41% of calls failed (7d)  ← attention line
 *
 * The attention line is the point: instead of making the operator hunt the
 * table, the page names the single most urgent thing the instant they land —
 * an erroring app, then a building one, otherwise an all-clear.
 */
export default function HomeCommandBar({
  organization,
  firstName,
}: {
  organization: string;
  firstName: string;
}) {
  const fleet = getOrgFleet();
  const orgSlug = organization.toLowerCase();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <header>
      {/* System readout — the terminal title-bar line. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] tracking-[0.02em] text-fg-faint">
        <span className="text-fg-strong">{orgSlug}</span>
        <Sep />
        <span>
          {fleet.count} {fleet.count === 1 ? "deployment" : "deployments"}
        </span>
      </div>

      {/* Greeting — the only sans-serif line up here, for warmth. */}
      <h1 className="mt-2.5 text-[28px] font-bold leading-[1.05] tracking-[-0.02em] text-fg">
        {greeting}, {firstName}
      </h1>

      <AttentionLine fleet={fleet} />
    </header>
  );
}

function Sep() {
  return (
    <span className="text-fg-disabled" aria-hidden="true">
      ·
    </span>
  );
}

function AttentionLine({ fleet }: { fleet: ReturnType<typeof getOrgFleet> }) {
  const errored = fleet.apps.filter((a) => a.deployment.status === "error");
  const building = fleet.apps.filter((a) => a.deployment.status === "building");

  // Erroring apps are the top priority — name the offender and route to it.
  if (errored.length > 0) {
    const single = errored.length === 1 ? errored[0] : null;
    return (
      <Line
        tone="red"
        icon={<TriangleAlert className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
        href={single ? `/apps/${single.id}?tab=overview` : "/apps"}
        cta={single ? "Inspect" : "View all"}
      >
        {single ? (
          <>
            <span className="font-semibold text-fg">{single.name}</span> is
            erroring —{" "}
            <span className="tabular-nums">
              {single.deployment.errorRatePct.toFixed(0)}%
            </span>{" "}
            of calls failed over 7d
          </>
        ) : (
          <>
            <span className="font-semibold text-fg">{errored.length} apps</span>{" "}
            are erroring and need attention
          </>
        )}
      </Line>
    );
  }

  // Then deploys in flight.
  if (building.length > 0) {
    const single = building.length === 1 ? building[0] : null;
    return (
      <Line
        tone="warm"
        icon={
          <Loader
            className="h-3.5 w-3.5 motion-safe:animate-spin [animation-duration:2s]"
            strokeWidth={2}
            aria-hidden="true"
          />
        }
        href={single ? `/apps/${single.id}?tab=overview` : "/apps?tab=logs"}
        cta={single ? "View build" : "View all"}
      >
        {single ? (
          <>
            <span className="font-semibold text-fg">{single.name}</span> is
            building — image and weights are being prepared
          </>
        ) : (
          <>
            <span className="font-semibold text-fg">
              {building.length} apps
            </span>{" "}
            are building
          </>
        )}
      </Line>
    );
  }

  // All clear.
  return (
    <Line tone="green" icon={<StatusDot tone="green" />} href="/apps" cta="View all">
      All systems healthy ·{" "}
      <span className="text-fg-strong tabular-nums">{fleet.deployed}</span> apps
      serving traffic
    </Line>
  );
}

const TONE_RING: Record<"red" | "warm" | "green", string> = {
  red: "border-red-400/25 bg-red-400/[0.06] text-red-400",
  warm: "border-warm/25 bg-warm/[0.06] text-warm",
  green: "border-green-bright/20 bg-green-bright/[0.05] text-green-bright",
};

function Line({
  tone,
  icon,
  href,
  cta,
  children,
}: {
  tone: "red" | "warm" | "green";
  icon: React.ReactNode;
  href: string;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group mt-4 flex items-center gap-2.5 rounded-md border px-3.5 py-2.5 transition-colors ${TONE_RING[tone]}`}
    >
      <span className="grid shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-fg-strong">
        {children}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11.5px] font-medium uppercase tracking-[0.04em] opacity-80 transition-opacity group-hover:opacity-100">
        {cta}
        <ArrowRight
          className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
