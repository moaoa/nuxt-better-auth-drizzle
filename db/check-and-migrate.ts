import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getMigrationsFolder } from "~~/db/migrations-path";
import { useDrizzle } from "~~/server/utils/drizzle";

/**
 * Applies pending SQL migrations from db/migrations (Drizzle journal).
 * Safe to call on every startup: already-applied migrations are skipped.
 */
export async function runPendingMigrations(): Promise<{
  ok: boolean;
  message: string;
}> {
  const migrationsFolder = getMigrationsFolder();
  const db = useDrizzle();

  try {
    await migrate(db, { migrationsFolder });
    return {
      ok: true,
      message: `Migrations finished (folder: ${migrationsFolder}).`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[DB Migrate] Migration failed:", errorMessage);
    throw new Error(`Migration failed: ${errorMessage}`);
  }
}
