import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import config from "~~/config/drizzle.config";
import { useDrizzle } from "~~/server/utils/drizzle";

/**
 * Checks if the database has been initialized by looking for the __drizzle_migrations table.
 * This table is created by Drizzle when migrations are first run.
 */
async function isDatabaseInitialized(): Promise<boolean> {
  const db = useDrizzle();

  try {
    // Check if __drizzle_migrations table exists
    const result = await db.execute<{ exists: boolean }>(
      sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '__drizzle_migrations'
        ) as exists;
      `
    );

    return result[0]?.exists === true;
  } catch (error) {
    // If there's an error checking, assume database is not initialized
    // This could happen if the database doesn't exist or connection fails
    console.error("Error checking if database is initialized:", error);
    return false;
  }
}

/**
 * Runs migrations if the database is empty (no __drizzle_migrations table exists).
 * Returns true if migrations were run, false if skipped.
 */
export async function checkAndMigrate(): Promise<{
  migrated: boolean;
  message: string;
}> {
  try {
    const isInitialized = await isDatabaseInitialized();

    if (isInitialized) {
      return {
        migrated: false,
        message: "Database already initialized. Skipping migrations.",
      };
    }

    console.log("Database is empty. Running migrations...");
    const db = useDrizzle();
    await migrate(db, { migrationsFolder: config.out! });

    return {
      migrated: true,
      message: "Migrations completed successfully.",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error during migration check:", errorMessage);
    throw new Error(`Migration failed: ${errorMessage}`);
  }
}
