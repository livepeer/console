import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { mcpAssets } from "@/db/schema";
import {
  assetStoreConfigured,
  getAssetDb,
  resetAssetDbForTests,
} from "@/db/client";

export type Asset = {
  id: string;
  url: string;
  capability: string;
  createdAt: string;
  /** Joins this asset to its ticket rows in PymtHouse metering. */
  gatewayRequestId: string;
  providerRequestId?: string | null;
};

export type ListAssetsInput = {
  query?: string;
  capability?: string;
  gatewayRequestId?: string;
  limit?: number;
  createdFrom?: Date;
  createdTo?: Date;
};

export type ForgetAssetsInput = {
  ids?: string[];
  all?: boolean;
};

export const ASSET_STORE_UNAVAILABLE = "asset_store_unavailable";
export const FORGET_IDS_OR_ALL_REQUIRED = "ids_or_all_required";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
/** Neon `ANY` / `IN` chunks — never drop leftover IDs. */
export const GATEWAY_ID_QUERY_CHUNK = 100;

export { assetStoreConfigured, resetAssetDbForTests as resetAssetStoreForTests };

export function chunkIds(
  ids: string[],
  size = GATEWAY_ID_QUERY_CHUNK
): string[][] {
  const unique = [
    ...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)),
  ];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += size) {
    chunks.push(unique.slice(i, i + size));
  }
  return chunks;
}

function clampLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

function asIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

/** Escape `%`, `_`, and `\` so ILIKE is a literal substring match. */
export function likeSubstring(query: string): string {
  return query.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function publicAssetStoreError(): {
  error: string;
  message: string;
} {
  return {
    error: ASSET_STORE_UNAVAILABLE,
    message: "Could not access persisted assets.",
  };
}

export function logAssetStoreError(err: unknown): void {
  const rec =
    err && typeof err === "object"
      ? (err as { name?: unknown; code?: unknown })
      : null;
  console.error(
    JSON.stringify({
      msg: "mcp.assets",
      name: rec && typeof rec.name === "string" ? rec.name : "Error",
      code: rec && typeof rec.code === "string" ? rec.code : undefined,
    })
  );
}

export function mapAssetRow(row: {
  id: string;
  url: string;
  capability: string;
  gatewayRequestId: string;
  providerRequestId: string | null;
  createdAt: Date | string;
}): Asset {
  return {
    id: row.id,
    url: row.url,
    capability: row.capability,
    createdAt: asIso(row.createdAt),
    gatewayRequestId: row.gatewayRequestId,
    providerRequestId: row.providerRequestId,
  };
}

export function serializeAsset(asset: Asset) {
  return {
    id: asset.id,
    url: asset.url,
    capability: asset.capability,
    created_at: asset.createdAt,
    gateway_request_id: asset.gatewayRequestId,
    provider_request_id: asset.providerRequestId ?? null,
  };
}

export async function rememberAsset(
  principalId: string,
  asset: Asset
): Promise<Asset> {
  const db = getAssetDb();
  const rows = await db
    .insert(mcpAssets)
    .values({
      id: asset.id,
      principalId,
      url: asset.url,
      capability: asset.capability,
      gatewayRequestId: asset.gatewayRequestId,
      providerRequestId: asset.providerRequestId ?? null,
    })
    .onConflictDoUpdate({
      target: [
        mcpAssets.principalId,
        mcpAssets.gatewayRequestId,
        mcpAssets.url,
      ],
      set: {
        capability: sql`excluded.capability`,
        providerRequestId: sql`coalesce(excluded.provider_request_id, ${mcpAssets.providerRequestId})`,
      },
    })
    .returning();
  const row = rows[0];
  if (!row) {
    throw new Error("mcp_assets insert returned no row");
  }
  return mapAssetRow(row);
}

export async function listAssets(
  principalId: string,
  input: ListAssetsInput = {}
): Promise<Asset[]> {
  const db = getAssetDb();
  const query = input.query?.trim() ? likeSubstring(input.query.trim()) : null;
  const capability = input.capability?.trim() || null;
  const gatewayRequestId = input.gatewayRequestId?.trim() || null;
  const limit = clampLimit(input.limit);
  const filters = [eq(mcpAssets.principalId, principalId)];
  if (capability) filters.push(eq(mcpAssets.capability, capability));
  if (gatewayRequestId) {
    filters.push(eq(mcpAssets.gatewayRequestId, gatewayRequestId));
  }
  if (input.createdFrom) {
    filters.push(gte(mcpAssets.createdAt, input.createdFrom));
  }
  if (input.createdTo) {
    filters.push(lte(mcpAssets.createdAt, input.createdTo));
  }
  if (query) {
    const pattern = `%${query}%`;
    filters.push(
      or(
        sql`${mcpAssets.capability} ILIKE ${pattern} ESCAPE '\\'`,
        sql`${mcpAssets.url} ILIKE ${pattern} ESCAPE '\\'`,
        sql`${mcpAssets.gatewayRequestId} ILIKE ${pattern} ESCAPE '\\'`
      )!
    );
  }
  const rows = await db
    .select()
    .from(mcpAssets)
    .where(and(...filters))
    .orderBy(desc(mcpAssets.createdAt))
    .limit(limit);
  return rows.map(mapAssetRow);
}

export async function listAssetsForGatewayRequestIds(
  principalId: string,
  gatewayRequestIds: string[]
): Promise<Asset[]> {
  const chunks = chunkIds(gatewayRequestIds);
  if (chunks.length === 0) return [];
  const db = getAssetDb();
  const batches = await Promise.all(
    chunks.map((ids) =>
      db
        .select()
        .from(mcpAssets)
        .where(
          and(
            eq(mcpAssets.principalId, principalId),
            inArray(mcpAssets.gatewayRequestId, ids)
          )
        )
        .orderBy(desc(mcpAssets.createdAt))
    )
  );
  return batches.flat().map(mapAssetRow);
}

export async function listAssetsInCreatedRange(
  principalId: string,
  createdFrom: Date,
  createdTo: Date
): Promise<Asset[]> {
  const db = getAssetDb();
  const rows = await db
    .select()
    .from(mcpAssets)
    .where(
      and(
        eq(mcpAssets.principalId, principalId),
        gte(mcpAssets.createdAt, createdFrom),
        lte(mcpAssets.createdAt, createdTo)
      )
    )
    .orderBy(desc(mcpAssets.createdAt));
  return rows.map(mapAssetRow);
}

export async function forgetAssets(
  principalId: string,
  input: ForgetAssetsInput = {}
): Promise<number> {
  const db = getAssetDb();
  const ids = input.ids?.filter((id) => id.trim()) ?? [];
  if (input.all === true) {
    const rows = await db
      .delete(mcpAssets)
      .where(eq(mcpAssets.principalId, principalId))
      .returning({ id: mcpAssets.id });
    return rows.length;
  }
  if (ids.length === 0) {
    const err = new Error(FORGET_IDS_OR_ALL_REQUIRED);
    err.name = FORGET_IDS_OR_ALL_REQUIRED;
    throw err;
  }
  const rows = await db
    .delete(mcpAssets)
    .where(
      and(eq(mcpAssets.principalId, principalId), inArray(mcpAssets.id, ids))
    )
    .returning({ id: mcpAssets.id });
  return rows.length;
}
