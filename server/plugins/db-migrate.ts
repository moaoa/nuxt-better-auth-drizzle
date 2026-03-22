import { runPendingMigrations } from "~~/db/check-and-migrate";

/**
 * Runs Drizzle SQL migrations on Nitro startup in production.
 * Pending migrations only (tracked in db/migrations/meta); already applied are skipped.
 */
export default defineNitroPlugin(async () => {
  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[DB Migrate] Skipping auto-migration in non-production environment"
    );
    return;
  }

  try {
    const result = await runPendingMigrations();
    console.log(`[DB Migrate] ${result.message}`);
  } catch (error) {
    console.error("[DB Migrate] Migration failed:", error);
    throw error;
  }
});
