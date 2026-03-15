import { checkAndMigrate } from "~~/db/check-and-migrate";

/**
 * Nuxt server plugin that automatically runs database migrations on first deployment.
 * Only runs in production environment when the database is empty.
 * 
 * This plugin:
 * - Checks if the database has been initialized (by looking for __drizzle_migrations table)
 * - Runs migrations only if the database is empty
 * - Skips migrations on subsequent deployments
 * - Logs the migration status for debugging
 */
export default defineNitroPlugin(async (nitroApp) => {
  // Only run migrations in production
  // In development, use manual migration commands (db:push, db:migrate, etc.)
  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[DB Migrate] Skipping auto-migration in non-production environment"
    );
    return;
  }

  // Run migration check asynchronously to not block server startup
  checkAndMigrate()
    .then((result) => {
      if (result.migrated) {
        console.log(`[DB Migrate] ✓ ${result.message}`);
      } else {
        console.log(`[DB Migrate] ℹ ${result.message}`);
      }
    })
    .catch((error) => {
      // Log error but don't crash the server
      // The application might still work if migrations were partially applied
      console.error("[DB Migrate] ✗ Migration error:", error);
      console.error(
        "[DB Migrate] Server will continue, but database may not be fully initialized."
      );
    });
});
