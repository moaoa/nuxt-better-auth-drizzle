import { defineConfig } from "drizzle-kit";

/**
 * Constructs the database URL from separate environment variables or uses DATABASE_URL if provided.
 * Falls back to constructing from DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME if DATABASE_URL is not set.
 */
function getDatabaseUrl(): string {
  // Use DATABASE_URL if provided (backward compatibility)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Construct from separate variables
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USER || process.env.POSTGRES_USER || "postgres";
  const password =
    process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || "";
  const database = process.env.DB_NAME || process.env.POSTGRES_DB || "postgres";

  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
