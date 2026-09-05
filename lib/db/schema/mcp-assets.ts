import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
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
