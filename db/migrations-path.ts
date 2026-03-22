import { join } from "node:path";

/**
 * Absolute path to the Drizzle migrations folder at runtime.
 * Matches `out` in config/drizzle.config.ts (`./db/migrations`).
 * Uses process.cwd() so it resolves correctly in Docker (WORKDIR /app) and local dev.
 */
export function getMigrationsFolder(): string {
  return join(process.cwd(), "db", "migrations");
}
