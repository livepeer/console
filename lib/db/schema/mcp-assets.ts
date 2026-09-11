import {
  check,
  integer,
  index,
  foreignKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { runs } from "./runs";

/** MCP-produced media URLs, scoped per console/MCP principal (`eu_…`). */
export const mcpAssets = pgTable(
  "mcp_assets",
  {
    id: text("id").primaryKey(),
    principalId: text("principal_id").notNull(),
    url: text("url").notNull(),
    capability: text("capability").notNull(),
    gatewayRequestId: text("gateway_request_id").notNull(),
    providerRequestId: text("provider_request_id"),
    // Nullable for existing references and writers not yet capturing runs.
    runId: text("run_id"),
    mediaType: text("media_type"),
    // A provider guarantee is not an exact expiry. Neither deletes this row.
    availableUntil: timestamp("available_until", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    unavailableAt: timestamp("unavailable_at", { withTimezone: true }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "mcp_assets_run_owner_fk",
      columns: [table.runId, table.principalId, table.gatewayRequestId],
      foreignColumns: [runs.id, runs.principalId, runs.gatewayRequestId],
    }).onDelete("restrict"),
    index("mcp_assets_run_idx").on(table.runId),
    uniqueIndex("mcp_assets_principal_job_url_unique").on(
      table.principalId,
      table.gatewayRequestId,
      table.url
    ),
    index("mcp_assets_principal_created_idx").on(
      table.principalId,
      table.createdAt.desc()
    ),
    index("mcp_assets_principal_capability_idx").on(
      table.principalId,
      table.capability
    ),
  ]
);

/** Durable creative-lineage edges. mcp_assets.run_id remains the convenient
 * producer pointer; this table is canonical for both input and output use. */
export const runAssetLinks = pgTable(
  "run_asset_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "restrict" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => mcpAssets.id, { onDelete: "restrict" }),
    direction: text("direction").notNull(),
    role: text("role").notNull(),
    parameterPath: text("parameter_path"),
    ordinal: integer("ordinal").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("run_asset_links_edge_unique").on(
      table.runId,
      table.assetId,
      table.direction,
      table.parameterPath,
      table.ordinal
    ),
    index("run_asset_links_run_idx").on(table.runId, table.direction),
    index("run_asset_links_asset_idx").on(table.assetId, table.direction),
    check(
      "run_asset_links_direction_check",
      sql`${table.direction} in ('input', 'output')`
    ),
    check("run_asset_links_ordinal_check", sql`${table.ordinal} >= 0`),
  ]
);
