import { APPS, PIPELINE_APP_IDS } from "./mock-data";
import type { Pipeline } from "./types";

/**
 * Single source of truth for "the org's apps" on Home.
 *
 * An app can be deployed to more than one environment, so the unified APPS list
 * carries the same app (by `deployment.pipelineId`) more than once. Every Home
 * surface needs the *deduped* set and the same aggregate total — computing it
 * in several places is how the headline number and the table drift apart.
 * Compute once, here.
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
  // The org's own deployed apps — every one carries a deployment manifest.
  const owned = APPS.filter(
    (a): a is Pipeline => PIPELINE_APP_IDS.has(a.id) && !!a.deployment,
  );

  const seen = new Set<string>();
  const apps = owned.filter((a) => {
    if (seen.has(a.deployment.pipelineId)) return false;
    seen.add(a.deployment.pipelineId);
    return true;
  });

  return {
    apps,
    count: apps.length,
    deployed: apps.filter((a) => a.deployment.status === "deployed").length,
    building: apps.filter((a) => a.deployment.status === "building").length,
    errored: apps.filter((a) => a.deployment.status === "error").length,
    totalCalls7d: apps.reduce(
      (sum, a) => sum + (a.deployment.calls7d || 0),
      0,
    ),
  };
}

/** Compact call-count formatting shared across Home surfaces (51.4K, 1.2M). */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
