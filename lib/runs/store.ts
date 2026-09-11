import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { publicOrigin } from "@/lib/assets/public";
import { getDb } from "@/lib/db";
import {
  externalAccounts,
  mcpAssets,
  runAssetLinks,
  runEvents,
  runReadAudits,
  runReconciliationJobs,
  runUsageReceipts,
  runPaymentManifests,
  runs,
  userEmails,
} from "@/lib/db/schema";
import {
  configuredPymthouseScope,
  findExternalAccountOwner,
} from "@/lib/external-accounts/service";
import { getAdminPrincipalForUser } from "@/lib/admin/permissions";
import type { AdminPrincipal } from "@/lib/platform/contracts";
import type {
  CreateRunInput,
  ReconciliationJob,
  RunDetail,
  RunListQuery,
  RunOwner,
  RunPage,
  RunRecord,
  RunStatus,
  RunSummary,
  RunTransition,
  JsonValue,
} from "./types";
import {
  addDecimalStrings,
  billingSummaryFromReceipts,
  billingSummaryFromManifests,
} from "./billing";

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Database | Transaction;
const terminal = new Set<RunStatus>(["succeeded", "failed", "cancelled"]);
const iso = (value: Date | null) => value?.toISOString() ?? null;

type AssetReference = {
  id: string;
  parameterPath: string;
  role: string;
  ordinal: number;
};

function assetReferences(value: JsonValue | undefined): AssetReference[] {
  const found: AssetReference[] = [];
  const visit = (item: JsonValue, path: (string | number)[]): void => {
    if (typeof item === "string") {
      try {
        const referenceUrl = new URL(item);
        if (referenceUrl.origin !== publicOrigin()) return;
        const match = referenceUrl.pathname.match(/^\/api\/assets\/([^/]+)$/);
        if (!match) return;
        const field = [...path]
          .reverse()
          .find((part) => typeof part === "string");
        const ordinal = [...path]
          .reverse()
          .find((part) => typeof part === "number");
        found.push({
          id: decodeURIComponent(match[1]!),
          parameterPath: path.join("."),
          role: typeof field === "string" ? field : "input",
          ordinal: typeof ordinal === "number" ? ordinal : 0,
        });
      } catch {
        // Captured strings need not be URLs.
      }
      return;
    }
    if (Array.isArray(item))
      item.forEach((child, index) => visit(child, [...path, index]));
    else if (item && typeof item === "object")
      Object.entries(item).forEach(([key, child]) =>
        visit(child, [...path, key])
      );
  };
  if (value !== undefined) visit(value, []);
  return found;
}

export async function resolveRunOwner(principalId: string): Promise<RunOwner> {
  const account = await findExternalAccountOwner({
    ...configuredPymthouseScope(),
    externalUserId: principalId,
  });
  if (!account) throw new Error("run_owner_unresolved");
  return { principalId, userId: account.userId, externalAccountId: account.id };
}

function ownerWhere(owner: RunOwner): SQL {
  return and(
    eq(runs.principalId, owner.principalId),
    eq(runs.userId, owner.userId),
    eq(runs.externalAccountId, owner.externalAccountId)
  )!;
}

function record(
  row: typeof runs.$inferSelect,
  email: string | null = null
): RunRecord {
  return {
    ...row,
    email,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
  };
}

async function detail(
  db: Reader,
  row: typeof runs.$inferSelect
): Promise<RunDetail> {
  const links = await db
    .select()
    .from(runAssetLinks)
    .where(eq(runAssetLinks.runId, row.id))
    .orderBy(asc(runAssetLinks.direction), asc(runAssetLinks.ordinal));
  const referencedAssetIds = new Set([
    ...assetReferences(row.submittedArguments ?? undefined).map(({ id }) => id),
    ...links.map(({ assetId }) => assetId),
  ]);
  const assetFilter = referencedAssetIds.size
    ? or(
        eq(mcpAssets.runId, row.id),
        and(
          eq(mcpAssets.principalId, row.principalId),
          inArray(mcpAssets.id, [...referencedAssetIds])
        )
      )
    : eq(mcpAssets.runId, row.id);
  const [assets, events, receipts, emails, manifests] = await Promise.all([
    db
      .select()
      .from(mcpAssets)
      .where(assetFilter)
      .orderBy(asc(mcpAssets.createdAt), asc(mcpAssets.id)),
    db
      .select()
      .from(runEvents)
      .where(eq(runEvents.runId, row.id))
      .orderBy(asc(runEvents.createdAt), asc(runEvents.id)),
    db
      .select({ networkFeeUsdMicros: runUsageReceipts.networkFeeUsdMicros })
      .from(runUsageReceipts)
      .where(eq(runUsageReceipts.runId, row.id))
      .orderBy(asc(runUsageReceipts.occurredAt), asc(runUsageReceipts.id)),
    db
      .select({ email: userEmails.email })
      .from(userEmails)
      .where(
        and(eq(userEmails.userId, row.userId), eq(userEmails.isPrimary, true))
      )
      .limit(1),
    db
      .select()
      .from(runPaymentManifests)
      .where(eq(runPaymentManifests.runId, row.id)),
  ]);
  const mappedEvents = events.map((event) => ({
    ...event,
    createdAt: event.createdAt.toISOString(),
  }));
  const linksByAsset = new Map(links.map((link) => [link.assetId, link]));
  return {
    ...record(row, emails[0]?.email ?? null),
    assets: assets.map((asset) => ({
      id: asset.id,
      role:
        linksByAsset.get(asset.id)?.direction === "input" ||
        asset.runId !== row.id
          ? "input"
          : "output",
      url: asset.url,
      mediaType: asset.mediaType,
      providerRequestId: asset.providerRequestId,
      availableUntil: iso(asset.availableUntil),
      expiresAt: iso(asset.expiresAt),
      unavailableAt: iso(asset.unavailableAt),
      hiddenAt: iso(asset.hiddenAt),
      createdAt: asset.createdAt.toISOString(),
    })),
    events: mappedEvents,
    billing: manifests.length
      ? billingSummaryFromManifests(manifests)
      : billingSummaryFromReceipts(receipts),
  };
}

export async function createRun(
  owner: RunOwner,
  input: CreateRunInput
): Promise<RunDetail> {
  return getDb().transaction((tx) => createRunTx(tx, owner, input));
}

async function createRunTx(
  tx: Transaction,
  owner: RunOwner,
  input: CreateRunInput,
  repairFixture = false
): Promise<RunDetail> {
  // Independently enforce the authenticated binding even when a caller constructs an owner object.
  const scope = configuredPymthouseScope();
  const [account] = await tx
    .select({ id: externalAccounts.id })
    .from(externalAccounts)
    .where(
      and(
        eq(externalAccounts.id, owner.externalAccountId),
        eq(externalAccounts.userId, owner.userId),
        eq(externalAccounts.externalUserId, owner.principalId),
        eq(externalAccounts.service, scope.service),
        eq(externalAccounts.issuer, scope.issuer),
        eq(externalAccounts.appId, scope.appId)
      )
    );
  if (!account) throw new Error("run_owner_unresolved");
  const [existing] =
    repairFixture && input.id
      ? await tx
          .select()
          .from(runs)
          .where(and(ownerWhere(owner), eq(runs.id, input.id)))
      : [];
  const row =
    existing ??
    (
      await tx
        .insert(runs)
        .values({
          ...owner,
          ...input,
          id: input.id ?? randomUUID(),
          source: "mcp",
          status: "queued",
        })
        .returning()
    )[0]!;
  await tx
    .insert(runEvents)
    .values({ runId: row.id, eventKey: "created", status: "queued" })
    .onConflictDoNothing();
  const references = assetReferences(row.submittedArguments ?? undefined);
  if (references.length) {
    const ownedAssets = await tx
      .select({ id: mcpAssets.id })
      .from(mcpAssets)
      .where(
        and(
          eq(mcpAssets.principalId, owner.principalId),
          inArray(mcpAssets.id, [...new Set(references.map(({ id }) => id))])
        )
      );
    const ownedIds = new Set(ownedAssets.map(({ id }) => id));
    const values = references
      .filter(({ id }) => ownedIds.has(id))
      .map((reference) => ({
        runId: row.id,
        assetId: reference.id,
        direction: "input",
        role: reference.role,
        parameterPath: reference.parameterPath,
        ordinal: reference.ordinal,
      }));
    if (values.length)
      await tx.insert(runAssetLinks).values(values).onConflictDoNothing();
  }
  return detail(tx, row);
}

export async function transitionRun(
  owner: RunOwner,
  id: string,
  change: RunTransition
): Promise<RunDetail> {
  if (!change.eventKey.trim()) throw new Error("invalid_run_event_key");
  return getDb().transaction((tx) => transitionRunTx(tx, owner, id, change));
}

async function transitionRunTx(
  tx: Transaction,
  owner: RunOwner,
  id: string,
  change: RunTransition,
  repairFixture = false
): Promise<RunDetail> {
  if (!change.eventKey.trim()) throw new Error("invalid_run_event_key");

  const [current] = await tx
    .select()
    .from(runs)
    .where(and(ownerWhere(owner), eq(runs.id, id)))
    .for("update");
  if (!current) throw new Error("run_not_found");
  if (change.reconciliationLease) {
    const [lease] = await tx
      .select()
      .from(runReconciliationJobs)
      .where(
        and(
          eq(runReconciliationJobs.id, change.reconciliationLease.jobId),
          eq(runReconciliationJobs.runId, id)
        )
      )
      .for("update");
    if (
      !lease ||
      lease.leaseToken !== change.reconciliationLease.leaseToken ||
      !lease.leasedUntil ||
      lease.leasedUntil <= new Date() ||
      lease.completedAt
    )
      throw new Error("run_reconciliation_lease_lost");
  }
  const [existing] = await tx
    .select({ id: runEvents.id })
    .from(runEvents)
    .where(
      and(eq(runEvents.runId, id), eq(runEvents.eventKey, change.eventKey))
    );
  if (!repairFixture && (existing || terminal.has(current.status)))
    return detail(tx, current);
  if (
    change.expectedVersion !== undefined &&
    current.version !== change.expectedVersion
  )
    throw new Error("run_version_conflict");
  if (change.status === "queued" && current.status !== "queued")
    throw new Error("invalid_run_transition");
  const now = new Date();
  const row =
    repairFixture && terminal.has(current.status)
      ? current
      : (
          await tx
            .update(runs)
            .set({
              status: change.status,
              provider: change.provider ?? current.provider,
              providerRequestId:
                change.providerRequestId ?? current.providerRequestId,
              result: change.result ?? current.result,
              errorCode:
                change.errorCode === undefined
                  ? current.errorCode
                  : change.errorCode,
              errorMessage:
                change.errorMessage === undefined
                  ? current.errorMessage
                  : change.errorMessage,
              startedAt:
                current.startedAt ?? (change.status === "running" ? now : null),
              completedAt: terminal.has(change.status) ? now : null,
              updatedAt: now,
              version: current.version + 1,
            })
            .where(eq(runs.id, id))
            .returning()
        )[0]!;
  if (change.assets?.length) {
    for (const [ordinal, asset] of change.assets.entries()) {
      const url = new URL(asset.url);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("invalid_run_asset_url");
      const [persisted] = await tx
        .insert(mcpAssets)
        .values({
          id: asset.id ?? randomUUID(),
          runId: id,
          principalId: owner.principalId,
          gatewayRequestId: current.gatewayRequestId,
          capability: current.capability,
          providerRequestId:
            asset.providerRequestId ?? change.providerRequestId ?? null,
          url: asset.url,
          mediaType: asset.mediaType ?? null,
          availableUntil: asset.availableUntil
            ? new Date(asset.availableUntil)
            : null,
          expiresAt: asset.expiresAt ? new Date(asset.expiresAt) : null,
        })
        .onConflictDoUpdate({
          target: [
            mcpAssets.principalId,
            mcpAssets.gatewayRequestId,
            mcpAssets.url,
          ],
          set: {
            providerRequestId: sql`coalesce(excluded.provider_request_id, ${mcpAssets.providerRequestId})`,
            mediaType: sql`coalesce(excluded.media_type, ${mcpAssets.mediaType})`,
            availableUntil: sql`coalesce(excluded.available_until, ${mcpAssets.availableUntil})`,
            expiresAt: sql`coalesce(excluded.expires_at, ${mcpAssets.expiresAt})`,
          },
        })
        .returning({ id: mcpAssets.id });
      if (persisted)
        await tx
          .insert(runAssetLinks)
          .values({
            runId: id,
            assetId: persisted.id,
            direction: "output",
            role: "generated_output",
            parameterPath: "result",
            ordinal,
          })
          .onConflictDoNothing();
    }
  }
  await tx
    .insert(runEvents)
    .values({
      runId: id,
      eventKey: change.eventKey,
      status: change.status,
      metadata: change.metadata ?? {},
    })
    .onConflictDoNothing();
  if (
    change.queue &&
    !change.stopReconciliation &&
    !terminal.has(change.status)
  ) {
    // Progress receipts are recovery breadcrumbs, not authority to race the live SDK.
    // The final dispatch receipt wakes recovery immediately; a crash falls back after 15m.
    const progressOnly = change.eventKey.startsWith("progress:");
    const availableAt = progressOnly
      ? new Date(current.createdAt.getTime() + 15 * 60_000)
      : now;
    await tx
      .insert(runReconciliationJobs)
      .values({
        runId: id,
        queue: change.queue,
        availableAt,
        deadlineAt: new Date(current.createdAt.getTime() + 86_400_000),
      })
      .onConflictDoUpdate({
        target: runReconciliationJobs.runId,
        set: {
          queue: change.queue,
          leaseToken: sql`case when ${runReconciliationJobs.queue} is distinct from excluded.queue then null else ${runReconciliationJobs.leaseToken} end`,
          leasedUntil: sql`case when ${runReconciliationJobs.queue} is distinct from excluded.queue then null else ${runReconciliationJobs.leasedUntil} end`,
          completedAt: sql`case when ${runReconciliationJobs.queue} is distinct from excluded.queue then null else ${runReconciliationJobs.completedAt} end`,
          availableAt,
          attempts: sql`case when ${runReconciliationJobs.queue} is distinct from excluded.queue then 0 else ${runReconciliationJobs.attempts} end`,
          lastReason: sql`case when ${runReconciliationJobs.queue} is distinct from excluded.queue then 'queue_handle_replaced' else ${runReconciliationJobs.lastReason} end`,
        },
        setWhere: sql`${runReconciliationJobs.queue} is distinct from excluded.queue or (${!progressOnly} and ${runReconciliationJobs.completedAt} is null)`,
      });
  }
  if (terminal.has(change.status) || change.stopReconciliation)
    await tx
      .update(runReconciliationJobs)
      .set({
        completedAt: now,
        leaseToken: null,
        leasedUntil: null,
        lastReason: change.stopReconciliation ?? "run_terminal",
      })
      .where(eq(runReconciliationJobs.runId, id));
  return detail(tx, row);
}

export async function getOwnRun(
  owner: RunOwner,
  id: string
): Promise<RunDetail | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(runs)
    .where(and(ownerWhere(owner), eq(runs.id, id)));
  return row ? detail(db, row) : null;
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    );
    if (
      typeof parsed.id !== "string" ||
      !parsed.id ||
      typeof parsed.createdAt !== "string"
    )
      throw new Error();
    const createdAt = new Date(parsed.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || cursor.length > 1024)
      throw new Error();
    return { createdAt, id: parsed.id };
  } catch {
    throw new Error("invalid_run_cursor");
  }
}

async function list(
  db: Reader,
  where: SQL | undefined,
  query: RunListQuery
): Promise<RunPage> {
  const base = [where];
  if (query.search?.trim()) {
    const pattern = `%${query.search.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    base.push(
      sql`(${userEmails.email} ilike ${pattern} escape '\\' or ${runs.capability} ilike ${pattern} escape '\\' or ${runs.gatewayRequestId} ilike ${pattern} escape '\\')`
    );
  }
  const filters = [...base];
  if (query.status) filters.push(eq(runs.status, query.status));
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    filters.push(
      or(
        lt(runs.createdAt, cursor.createdAt),
        and(eq(runs.createdAt, cursor.createdAt), lt(runs.id, cursor.id))
      )
    );
  }
  const limit = Math.max(1, Math.min(100, Math.trunc(query.limit ?? 25) || 25));
  const rows = await db
    .select({ row: runs, email: userEmails.email })
    .from(runs)
    .leftJoin(
      userEmails,
      and(eq(userEmails.userId, runs.userId), eq(userEmails.isPrimary, true))
    )
    .where(and(...filters))
    .orderBy(desc(runs.createdAt), desc(runs.id))
    .limit(limit + 1);
  const visibleRows = rows.slice(0, limit);
  const billingReceipts = visibleRows.length
    ? await db
        .select({
          runId: runUsageReceipts.runId,
          networkFeeUsdMicros: runUsageReceipts.networkFeeUsdMicros,
        })
        .from(runUsageReceipts)
        .where(
          inArray(
            runUsageReceipts.runId,
            visibleRows.map(({ row }) => row.id)
          )
        )
    : [];
  const billingByRun = new Map<
    string,
    { networkFeeUsdMicros: string | null }[]
  >();
  for (const receipt of billingReceipts) {
    const receipts = billingByRun.get(receipt.runId) ?? [];
    receipts.push({ networkFeeUsdMicros: receipt.networkFeeUsdMicros });
    billingByRun.set(receipt.runId, receipts);
  }
  const manifests = visibleRows.length
    ? await db
        .select()
        .from(runPaymentManifests)
        .where(
          inArray(
            runPaymentManifests.runId,
            visibleRows.map(({ row }) => row.id)
          )
        )
    : [];
  const manifestsByRun = new Map<string, typeof manifests>();
  for (const manifest of manifests) {
    const group = manifestsByRun.get(manifest.runId) ?? [];
    group.push(manifest);
    manifestsByRun.set(manifest.runId, group);
  }
  const grouped = await db
    .select({ status: runs.status, count: sql<number>`count(*)::int` })
    .from(runs)
    .leftJoin(
      userEmails,
      and(eq(userEmails.userId, runs.userId), eq(userEmails.isPrimary, true))
    )
    .where(and(...base))
    .groupBy(runs.status);
  const counts: RunPage["counts"] = {
    total: 0,
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    unknown: 0,
  };
  for (const group of grouped) {
    counts[group.status] = group.count;
    counts.total += group.count;
  }
  const items: RunSummary[] = visibleRows.map(({ row, email }) => {
    const full = record(row, email);
    const {
      submittedArguments: _args,
      result: _result,
      captureRedactedPaths: _paths,
      ...summary
    } = full;
    void _args;
    void _result;
    void _paths;
    return {
      ...summary,
      billing: manifestsByRun.has(row.id)
        ? billingSummaryFromManifests(manifestsByRun.get(row.id)!)
        : billingSummaryFromReceipts(billingByRun.get(row.id) ?? []),
    };
  });
  const last = items.at(-1);
  return {
    items,
    counts,
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(
            JSON.stringify({ createdAt: last.createdAt, id: last.id })
          ).toString("base64url")
        : null,
  };
}

export function listOwnRuns(
  owner: RunOwner,
  query: RunListQuery = {}
): Promise<RunPage> {
  return list(getDb(), ownerWhere(owner), query);
}

async function validateAdmin(actor: AdminPrincipal): Promise<string> {
  if (!actor.userId) throw new Error("run_admin_required");
  const active = await getAdminPrincipalForUser(actor.userId);
  if (
    !active ||
    active.adminGrantId !== actor.adminGrantId ||
    active.signupId !== actor.signupId
  )
    throw new Error("run_admin_required");
  return actor.userId;
}

export async function listAdminRuns(
  actor: AdminPrincipal,
  query: RunListQuery = {}
): Promise<RunPage> {
  const actorUserId = await validateAdmin(actor);
  return getDb().transaction(async (tx) => {
    const result = await list(tx, undefined, query);
    await tx.insert(runReadAudits).values({
      actorUserId,
      adminGrantId: actor.adminGrantId,
      action: "list",
      resultCount: result.items.length,
    });
    return result;
  });
}

export async function getAdminRun(
  actor: AdminPrincipal,
  id: string
): Promise<RunDetail | null> {
  const actorUserId = await validateAdmin(actor);
  return getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(runs).where(eq(runs.id, id));
    if (!row) {
      await tx.insert(runReadAudits).values({
        actorUserId,
        adminGrantId: actor.adminGrantId,
        action: "detail",
        resultCount: 0,
      });
      return null;
    }
    const result = await detail(tx, row);
    await tx.insert(runReadAudits).values({
      actorUserId,
      adminGrantId: actor.adminGrantId,
      action: "detail",
      runId: id,
      resultCount: 1,
    });
    return result;
  });
}

export async function existingRunGatewayIds(
  owner: RunOwner,
  ids: string[]
): Promise<string[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  const found: string[] = [];
  for (let start = 0; start < unique.length; start += 100) {
    const rows = await getDb()
      .select({ id: runs.gatewayRequestId })
      .from(runs)
      .where(
        and(
          ownerWhere(owner),
          inArray(runs.gatewayRequestId, unique.slice(start, start + 100))
        )
      );
    found.push(...rows.map((row) => row.id));
  }
  return found;
}

/** Correlate authenticated upstream billing evidence; never reinterpret it as execution success. */
export async function recordRunUsage(
  owner: RunOwner,
  tickets: {
    eventId: string;
    gatewayRequestId: string;
    metadata: Record<string, JsonValue>;
  }[]
): Promise<string[]> {
  return getDb().transaction((tx) => recordRunUsageTx(tx, owner, tickets));
}

async function recordRunUsageTx(
  tx: Transaction,
  owner: RunOwner,
  tickets: {
    eventId: string;
    gatewayRequestId: string;
    metadata: Record<string, JsonValue>;
  }[]
): Promise<string[]> {
  const changed = new Set<string>();
  for (const ticket of [...tickets].sort(
    (a, b) =>
      a.gatewayRequestId.localeCompare(b.gatewayRequestId) ||
      a.eventId.localeCompare(b.eventId)
  )) {
    if (!ticket.eventId || !ticket.gatewayRequestId) continue;
    const [run] = await tx
      .select({ id: runs.id, status: runs.status })
      .from(runs)
      .where(
        and(
          ownerWhere(owner),
          eq(runs.gatewayRequestId, ticket.gatewayRequestId)
        )
      )
      .for("update");
    if (!run) continue;
    const decimal = (key: string) => {
      const value = ticket.metadata[key];
      return typeof value === "string" ? value : null;
    };
    const timestamp = ticket.metadata.timestamp;
    const insertedReceipt = await tx
      .insert(runUsageReceipts)
      .values({
        eventId: ticket.eventId,
        runId: run.id,
        gatewayRequestId: ticket.gatewayRequestId,
        occurredAt: typeof timestamp === "string" ? new Date(timestamp) : null,
        pipeline:
          typeof ticket.metadata.pipeline === "string"
            ? ticket.metadata.pipeline
            : null,
        modelId:
          typeof ticket.metadata.modelId === "string"
            ? ticket.metadata.modelId
            : null,
        networkFeeUsdMicros: decimal("networkFeeUsdMicros"),
        feeWei: decimal("feeWei"),
        pixels: decimal("pixels"),
        ethUsdPrice: decimal("ethUsdPrice"),
      })
      .onConflictDoNothing({ target: runUsageReceipts.eventId })
      .returning({ runId: runUsageReceipts.runId });
    if (!insertedReceipt[0]) continue;
    await tx
      .insert(runEvents)
      .values({
        runId: run.id,
        eventKey: `usage:${ticket.eventId}`,
        status: run.status,
        metadata: {
          ...ticket.metadata,
          kind: "billing_usage",
          eventId: ticket.eventId,
        },
      })
      .onConflictDoNothing({ target: [runEvents.runId, runEvents.eventKey] });
    changed.add(insertedReceipt[0].runId);
  }
  return [...changed];
}

export async function ownedRunsByIds(owner: RunOwner, ids: string[]) {
  const unique = [...new Set(ids)].slice(0, 50);
  if (!unique.length) return [];
  return getDb()
    .select({
      id: runs.id,
      gatewayRequestId: runs.gatewayRequestId,
      status: runs.status,
    })
    .from(runs)
    .where(and(ownerWhere(owner), inArray(runs.id, unique)));
}

export async function claimReconciliationJobs(
  limit = 10
): Promise<ReconciliationJob[]> {
  return getDb().transaction(async (tx) => {
    const now = new Date();
    const batchLimit = Math.max(1, Math.min(100, Math.trunc(limit) || 10));
    // Execution's 13-minute timeout has elapsed, plus a two-minute observation margin.
    // A missing callback/receipt is absence of evidence, never evidence of failure.
    const stale = await tx
      .select()
      .from(runs)
      .where(
        and(
          inArray(runs.status, ["queued", "running"]),
          lt(runs.updatedAt, new Date(now.getTime() - 15 * 60_000))
        )
      )
      .orderBy(asc(runs.gatewayRequestId))
      .limit(batchLimit)
      .for("update", { skipLocked: true });
    for (const run of stale) {
      const [job] = await tx
        .select({ id: runReconciliationJobs.id })
        .from(runReconciliationJobs)
        .where(eq(runReconciliationJobs.runId, run.id));
      await tx
        .update(runs)
        .set({
          status: "unknown",
          errorCode: "observation_interrupted",
          errorMessage: job
            ? "Execution observation was interrupted; provider recovery is pending."
            : "Execution observation was interrupted and no recoverable provider receipt was captured.",
          updatedAt: now,
          version: run.version + 1,
        })
        .where(eq(runs.id, run.id));
      await tx.insert(runEvents).values({
        runId: run.id,
        eventKey: `observation_interrupted:${run.version}`,
        status: "unknown",
        metadata: {
          reason: job ? "observation_interrupted" : "queue_receipt_unavailable",
        },
      });
    }
    // Lock runs before jobs, matching completion's lock order, to avoid deadlocks.
    const pending = await tx
      .select({ job: runReconciliationJobs, run: runs })
      .from(runReconciliationJobs)
      .innerJoin(runs, eq(runs.id, runReconciliationJobs.runId))
      .where(
        and(
          isNull(runReconciliationJobs.completedAt),
          lt(runReconciliationJobs.availableAt, now),
          or(
            isNull(runReconciliationJobs.leasedUntil),
            lt(runReconciliationJobs.leasedUntil, now)
          )
        )
      )
      .orderBy(asc(runReconciliationJobs.availableAt))
      .limit(batchLimit)
      .for("update", { of: runs, skipLocked: true });
    const claimed: ReconciliationJob[] = [];
    for (const { job, run } of pending) {
      if (terminal.has(run.status) || job.deadlineAt <= now) {
        await tx
          .update(runReconciliationJobs)
          .set({
            completedAt: now,
            lastReason: terminal.has(run.status)
              ? "run_terminal"
              : "recovery_horizon_exceeded",
          })
          .where(eq(runReconciliationJobs.id, job.id));
        if (!terminal.has(run.status)) {
          await tx
            .update(runs)
            .set({
              status: "unknown",
              errorCode: "recovery_horizon_exceeded",
              updatedAt: now,
              version: run.version + 1,
            })
            .where(eq(runs.id, run.id));
          await tx
            .insert(runEvents)
            .values({
              runId: run.id,
              eventKey: "recovery_horizon_exceeded",
              status: "unknown",
            })
            .onConflictDoNothing();
        }
        continue;
      }
      const leaseToken = randomUUID();
      await tx
        .update(runReconciliationJobs)
        .set({
          leaseToken,
          leasedUntil: new Date(now.getTime() + 60_000),
          attempts: job.attempts + 1,
        })
        .where(eq(runReconciliationJobs.id, job.id));
      claimed.push({
        id: job.id,
        runId: job.runId,
        owner: {
          principalId: run.principalId,
          userId: run.userId,
          externalAccountId: run.externalAccountId,
        },
        leaseToken,
        attempts: job.attempts + 1,
        deadlineAt: job.deadlineAt.toISOString(),
        queue: job.queue,
      });
    }
    return claimed;
  });
}

export async function releaseReconciliationJob(
  job: ReconciliationJob,
  update: { done: boolean; reason?: string; retryAfterSeconds?: number }
): Promise<void> {
  const delay = Math.max(
    5,
    Math.min(
      3600,
      update.retryAfterSeconds ??
        Math.min(3600, 15 * 2 ** Math.min(job.attempts, 8))
    )
  );
  await getDb()
    .update(runReconciliationJobs)
    .set({
      completedAt: update.done ? new Date() : null,
      lastReason: update.reason ?? null,
      availableAt: new Date(Date.now() + delay * 1000),
      leaseToken: null,
      leasedUntil: null,
    })
    .where(
      and(
        eq(runReconciliationJobs.id, job.id),
        eq(runReconciliationJobs.leaseToken, job.leaseToken)
      )
    );
}

/** Capture before paying, then mark accepted; neither phase claims execution success. */
export async function recordRunPaymentManifest(
  owner: RunOwner,
  runId: string,
  payment: { manifestId: string; phase: "prepared" | "accepted" }
): Promise<void> {
  if (
    !payment.manifestId ||
    payment.manifestId.length > 512 ||
    /\s/.test(payment.manifestId)
  )
    throw new Error("invalid_payment_manifest");
  await getDb().transaction(async (tx) => {
    const [run] = await tx
      .select({ id: runs.id })
      .from(runs)
      .where(and(ownerWhere(owner), eq(runs.id, runId)))
      .for("update");
    if (!run) throw new Error("run_owner_mismatch");
    const [saved] = await tx
      .insert(runPaymentManifests)
      .values({
        runId,
        externalAccountId: owner.externalAccountId,
        manifestId: payment.manifestId,
        accepted: payment.phase === "accepted",
      })
      .onConflictDoUpdate({
        target: [
          runPaymentManifests.externalAccountId,
          runPaymentManifests.manifestId,
        ],
        set: {
          accepted: sql`${runPaymentManifests.accepted} or ${payment.phase === "accepted"}`,
        },
        setWhere: eq(runPaymentManifests.runId, runId),
      })
      .returning({ id: runPaymentManifests.id });
    if (!saved) throw new Error("payment_manifest_already_linked");
  });
}

export async function ownedPaymentManifests(owner: RunOwner, ids: string[]) {
  const unique = [...new Set(ids)].slice(0, 50);
  if (!unique.length) return [];
  return getDb()
    .select({
      manifest: runPaymentManifests,
      status: runs.status,
      updatedAt: runs.updatedAt,
    })
    .from(runPaymentManifests)
    .innerJoin(runs, eq(runs.id, runPaymentManifests.runId))
    .where(
      and(
        ownerWhere(owner),
        eq(runPaymentManifests.externalAccountId, owner.externalAccountId),
        inArray(runs.id, unique)
      )
    );
}

/** Replace cumulative snapshots, never append them as charge receipts. */
export async function recordManifestUsage(
  owner: RunOwner,
  runIds: string[],
  aggregates: {
    manifestId: string;
    networkFeeUsdMicros: string;
    feeWei: string | null;
  }[],
  observedAt: Date
): Promise<string[]> {
  const changed = new Set<string>();
  await getDb().transaction(async (tx) => {
    const owned = await tx
      .select({ manifest: runPaymentManifests })
      .from(runPaymentManifests)
      .innerJoin(runs, eq(runs.id, runPaymentManifests.runId))
      .where(
        and(
          ownerWhere(owner),
          eq(runPaymentManifests.externalAccountId, owner.externalAccountId),
          inArray(runs.id, runIds)
        )
      )
      .orderBy(asc(runPaymentManifests.id))
      .for("update", { of: runPaymentManifests });
    const byId = new Map(aggregates.map((row) => [row.manifestId, row]));
    for (const { manifest } of owned) {
      const value = byId.get(manifest.manifestId);
      if (!value || (manifest.observedAt && manifest.observedAt >= observedAt))
        continue;
      if (
        !/^\d{1,30}(?:\.\d{1,18})?$/.test(value.networkFeeUsdMicros) ||
        (value.feeWei !== null && !/^\d{1,128}$/.test(value.feeWei))
      )
        throw new Error("invalid_manifest_usage");
      const sameFee =
        manifest.networkFeeUsdMicros !== null &&
        addDecimalStrings(manifest.networkFeeUsdMicros, "0") ===
          addDecimalStrings(value.networkFeeUsdMicros, "0");
      await tx
        .update(runPaymentManifests)
        .set({
          networkFeeUsdMicros: value.networkFeeUsdMicros,
          feeWei: value.feeWei,
          observedAt,
        })
        .where(eq(runPaymentManifests.id, manifest.id));
      if (!sameFee || manifest.feeWei !== value.feeWei)
        changed.add(manifest.runId);
    }
  });
  return [...changed];
}

/** Preview-only transaction boundary: fixed fixture IDs and owner-scoped lock. */
export async function withPreviewRunFixtures<T>(
  owner: RunOwner,
  work: (store: {
    createRun: (owner: RunOwner, input: CreateRunInput) => Promise<RunDetail>;
    transitionRun: typeof transitionRun;
    recordRunUsage: typeof recordRunUsage;
    ownedRunsByIds: typeof ownedRunsByIds;
    completedRunIds: () => Promise<string[]>;
  }) => Promise<T>
): Promise<T> {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.CONSOLE_PREVIEW_FIXTURES !== "1"
  )
    throw new Error("preview_fixtures_disabled");
  const suffix = createHash("sha256")
    .update(owner.principalId)
    .digest("hex")
    .slice(0, 12);
  const ids = new Set(
    ["portrait", "variation", "caption", "failed"].map(
      (name) => `run_preview_v2_${suffix}_${name}`
    )
  );
  const assertOwner = (candidate: RunOwner) => {
    if (
      candidate.principalId !== owner.principalId ||
      candidate.userId !== owner.userId ||
      candidate.externalAccountId !== owner.externalAccountId
    )
      throw new Error("preview_owner_mismatch");
  };
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL statement_timeout = '60s'`);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`console-preview:${owner.externalAccountId}`}, 0))`
    );
    return work({
      completedRunIds: async () => {
        const complete: string[] = [];
        // One query per fixture checks durable stages, not just run existence.
        for (const name of ["portrait", "variation", "caption", "failed"]) {
          const id = `run_preview_v2_${suffix}_${name}`;
          const receiptIds =
            name === "failed"
              ? []
              : name === "variation"
                ? [
                    `receipt_preview_v2_${suffix}_variation_1`,
                    `receipt_preview_v2_${suffix}_variation_2`,
                  ]
                : [`receipt_preview_v2_${suffix}_${name}`];
          const [state] = await tx
            .select({
              id: runs.id,
              complete: sql<boolean>`
              exists(select 1 from run_events e where e.run_id = ${id} and e.event_key = 'dispatch-returned')
              and (select count(*) from run_usage_receipts u where u.run_id = ${id} and u.event_id in (select jsonb_array_elements_text(${JSON.stringify(receiptIds)}::jsonb))) = ${receiptIds.length}
              and (${!["portrait", "variation"].includes(name)} or exists(select 1 from run_asset_links l join mcp_assets a on a.id = l.asset_id where l.run_id = ${id} and l.direction = 'output' and a.id = ${`asset_preview_v2_${suffix}_${name}`} and a.principal_id = ${owner.principalId}))
              and (${name !== "variation"} or exists(select 1 from run_asset_links l join mcp_assets a on a.id = l.asset_id where l.run_id = ${id} and l.direction = 'input' and a.id = ${`asset_preview_v2_${suffix}_portrait`} and a.principal_id = ${owner.principalId}))`,
            })
            .from(runs)
            .where(
              and(
                ownerWhere(owner),
                eq(runs.id, id),
                eq(runs.status, name === "failed" ? "failed" : "succeeded")
              )
            );
          if (state?.complete) complete.push(id);
        }
        return complete;
      },
      createRun: (candidate, input) => {
        assertOwner(candidate);
        if (!input.id || !ids.has(input.id))
          throw new Error("invalid_preview_fixture");
        return createRunTx(tx, owner, input, true);
      },
      transitionRun: (candidate, id, change) => {
        assertOwner(candidate);
        if (!ids.has(id) || change.eventKey !== "dispatch-returned")
          throw new Error("invalid_preview_fixture");
        return transitionRunTx(tx, owner, id, change, true);
      },
      recordRunUsage: (candidate, tickets) => {
        assertOwner(candidate);
        if (
          tickets.some(
            (ticket) =>
              ![...ids].some(
                (id) =>
                  ticket.gatewayRequestId ===
                  id.replace("run_preview_", "job_preview_")
              )
          )
        )
          throw new Error("invalid_preview_fixture");
        return recordRunUsageTx(tx, owner, tickets);
      },
      ownedRunsByIds: async (candidate, requested) => {
        assertOwner(candidate);
        if (requested.some((id) => !ids.has(id)))
          throw new Error("invalid_preview_fixture");
        return tx
          .select({
            id: runs.id,
            gatewayRequestId: runs.gatewayRequestId,
            status: runs.status,
          })
          .from(runs)
          .where(and(ownerWhere(owner), inArray(runs.id, requested)));
      },
    });
  });
}
