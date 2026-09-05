import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.MCP_ASSETS_DATABASE_URL?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      "postgresql://unused:unused@localhost/unused",
  },
});
