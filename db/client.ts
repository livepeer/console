import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type AssetDb = NeonHttpDatabase<typeof schema>;

let sqlClient: NeonQueryFunction<false, false> | null = null;
let dbClient: AssetDb | null = null;

export function databaseUrl(): string {
  const raw =
    process.env.MCP_ASSETS_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "DATABASE_URL (or MCP_ASSETS_DATABASE_URL) is required for MCP assets"
    );
  }
  const url = new URL(raw);
  url.searchParams.delete("channel_binding");
  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }
  return url.toString();
}

export function assetStoreConfigured(): boolean {
  return Boolean(
    process.env.MCP_ASSETS_DATABASE_URL?.trim() ||
      process.env.DATABASE_URL?.trim()
  );
}

export function getAssetDb(): AssetDb {
  if (!dbClient) {
    sqlClient = neon(databaseUrl());
    dbClient = drizzle(sqlClient, { schema });
  }
  return dbClient;
}

export function resetAssetDbForTests(): void {
  sqlClient = null;
  dbClient = null;
}
