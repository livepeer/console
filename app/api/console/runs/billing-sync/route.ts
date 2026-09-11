import { fetchManifestUsage } from "@/lib/console/manifest-usage";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  ownedPaymentManifests,
  ownedRunsByIds,
  recordManifestUsage,
  resolveRunOwner,
} from "@/lib/runs/store";
import { runError, RUN_HEADERS } from "@/lib/runs/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { runIds?: unknown };
    if (
      !Array.isArray(body.runIds) ||
      body.runIds.length > 50 ||
      body.runIds.some((id) => typeof id !== "string" || !id || id.length > 160)
    )
      throw new Error("invalid_run_query");
    const session = await requireConsoleSession();
    const owner = await resolveRunOwner(session.externalUserId);
    if (owner.userId !== session.canonicalUserId)
      throw new Error("run_owner_mismatch");
    const ids = [...new Set(body.runIds as string[])];
    const [owned, runs] = await Promise.all([
      ownedPaymentManifests(owner, ids),
      ownedRunsByIds(owner, ids),
    ]);
    const reply = (changedRunIds: string[], pending: boolean) =>
      Response.json(
        {
          changedRunIds,
          changedCount: changedRunIds.length,
          pending,
        },
        { headers: RUN_HEADERS }
      );
    const now = new Date();
    const active = runs.some(
      ({ status, updatedAt }) =>
        ["queued", "running", "unknown"].includes(status) ||
        now.getTime() - updatedAt.getTime() < 120_000
    );
    // Historical runs without a manifest are never guessed from model/time.
    if (!owned.length) return reply([], active);
    if (
      owned.every(
        ({ manifest }) =>
          manifest.observedAt &&
          now.getTime() - manifest.observedAt.getTime() < 30_000
      )
    )
      return reply(
        [],
        active ||
          owned.some(
            ({ manifest }) =>
              manifest.accepted && manifest.networkFeeUsdMicros === null
          )
      );
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
      externalUserId: session.externalUserId,
      email: session.email,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
    const wanted = new Set(owned.map(({ manifest }) => manifest.manifestId));
    const matched = aggregates.filter((row) => wanted.has(row.manifestId));
    const changed = await recordManifestUsage(owner, ids, matched, now);
    const found = new Set(matched.map((row) => row.manifestId));
    return reply(
      changed,
      active ||
        owned.some(
          ({ manifest }) => manifest.accepted && !found.has(manifest.manifestId)
        )
    );
  } catch (error) {
    return runError(error);
  }
}
