import { PIPELINES } from "./mock-data";
import type { Pipeline } from "./types";

/**
 * Single source of truth for "the org's apps" on Home.
 *
 * Pipelines can be deployed to more than one environment, so the raw PIPELINES
 * list contains the same app multiple times. Every Home surface needs the
 * *deduped* set and the same aggregate total — computing it in several places
 * is how the headline number and the table drift apart. Compute once, here.
 *
 * A deployed app's call count is a single public number (think package
 * downloads) — the network handles the calls; the org just published the app.
 */
export interface OrgFleet {
  /** One entry per app, deduped by pipelineId, original order preserved. */
  apps: Pipeline[];
  count: number;
  deployed: number;
  building: number;
  errored: number;
  /** Sum of 7-day call volume across the deduped set (calls these apps handled). */
  totalCalls7d: number;
}

export function getOrgFleet(): OrgFleet {
  const seen = new Set<string>();
  const apps = PIPELINES.filter((p) => {
    if (seen.has(p.pipelineId)) return false;
    seen.add(p.pipelineId);
    return true;
  });

  return {
    apps,
    count: apps.length,
    deployed: apps.filter((a) => a.status === "deployed").length,
    building: apps.filter((a) => a.status === "building").length,
    errored: apps.filter((a) => a.status === "error").length,
    totalCalls7d: apps.reduce((sum, a) => sum + (a.calls7d || 0), 0),
  };
}

/** Compact call-count formatting shared across Home surfaces (51.4K, 1.2M). */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
