import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/lib/db/schema";
import { getEnv } from "@/lib/env";

let client: ReturnType<typeof postgres> | undefined;

export function getDb() {
  const connectionString = getEnv().DATABASE_URL;

  client ??= postgres(connectionString, {
    max: 1,
    prepare: false,
  });

  return drizzle(client, { schema });
}
