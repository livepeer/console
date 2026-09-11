import { fetchManifestUsage } from "@/lib/console/manifest-usage";
import {
  ownedPaymentManifests,
  ownedRunsByIds,
  recordManifestUsage,
} from "@/lib/runs/store";
import type { RunOwner } from "@/lib/runs/types";

export type ManifestBillingRefresh = {
  changedRunIds: string[];
  pending: boolean;
};

/** One PymtHouse aggregate read for owned manifests; never invents a missing fee. */
export async function refreshOwnedRunBilling(input: {
  owner: RunOwner;
  externalUserId: string;
  email?: string;
  runIds: string[];
  now?: Date;
}): Promise<ManifestBillingRefresh> {
  const ids = [...new Set(input.runIds)].slice(0, 50);
  const [owned, runs] = await Promise.all([
    ownedPaymentManifests(input.owner, ids),
    ownedRunsByIds(input.owner, ids),
  ]);
  const now = input.now ?? new Date();
  const active = runs.some(
    ({ status, updatedAt }) =>
      ["queued", "running", "unknown"].includes(status) ||
      now.getTime() - updatedAt.getTime() < 120_000
  );
  const pendingWithoutFee = (found?: Set<string>) =>
    active ||
    owned.some(({ manifest }) =>
      found
        ? manifest.accepted && !found.has(manifest.manifestId)
        : manifest.accepted && manifest.networkFeeUsdMicros === null
    );
  // Historical runs without a manifest are never guessed from model/time.
  if (!owned.length) return { changedRunIds: [], pending: active };
  if (
    owned.every(
      ({ manifest }) =>
        manifest.observedAt &&
        now.getTime() - manifest.observedAt.getTime() < 30_000
    )
  )
    return { changedRunIds: [], pending: pendingWithoutFee() };
  // Each snapshot covers the manifest's entire lifetime, including month boundaries.
  const first = new Date(
    Math.min(...owned.map(({ manifest }) => manifest.createdAt.getTime()))
  );
  const start = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1)
  );
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const aggregates = await fetchManifestUsage({
    externalUserId: input.externalUserId,
    email: input.email,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });
  const wanted = new Set(owned.map(({ manifest }) => manifest.manifestId));
  const matched = aggregates.filter((row) => wanted.has(row.manifestId));
  const changedRunIds = await recordManifestUsage(
    input.owner,
    ids,
    matched,
    now
  );
  return {
    changedRunIds,
    pending: pendingWithoutFee(new Set(matched.map((row) => row.manifestId))),
  };
}

/** Exact manifest match for one run. Does not require History. */
export async function refreshOwnedRunBillingByJob(input: {
  owner: RunOwner;
  runId: string;
  externalUserId: string;
  email?: string;
  now?: Date;
  retryDelayMs?: number;
}): Promise<ManifestBillingRefresh> {
  const owned = await ownedPaymentManifests(input.owner, [input.runId]);
  const accepted = owned.filter(({ manifest }) => manifest.accepted);
  if (!accepted.length) return { changedRunIds: [], pending: false };
  const now = input.now ?? new Date();
  const start = new Date(
    Math.min(...accepted.map(({ manifest }) => manifest.createdAt.getTime())) -
      60_000
  );
  const wanted = new Set(accepted.map(({ manifest }) => manifest.manifestId));
  const delay = input.retryDelayMs ?? 1000;
  let matched: Awaited<ReturnType<typeof fetchManifestUsage>> = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const aggregates = await fetchManifestUsage({
      externalUserId: input.externalUserId,
      email: input.email,
      startDate: start.toISOString(),
      endDate: now.toISOString(),
    });
    matched = aggregates.filter((row) => wanted.has(row.manifestId));
    if (matched.length === wanted.size) break;
    if (attempt < 2 && delay > 0)
      await new Promise((resolve) =>
        setTimeout(resolve, delay * (attempt + 1))
      );
  }
  if (!matched.length) return { changedRunIds: [], pending: true };
  const changedRunIds = await recordManifestUsage(
    input.owner,
    [input.runId],
    matched,
    now
  );
  return {
    changedRunIds,
    pending: accepted.some(
      ({ manifest }) =>
        !matched.some((row) => row.manifestId === manifest.manifestId)
    ),
  };
}
