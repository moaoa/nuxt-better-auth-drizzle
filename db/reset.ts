import { sql } from "drizzle-orm";
import { useDrizzle } from "~~/server/utils/drizzle";

const db = useDrizzle();

async function main() {
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE;`);
    await db.execute(sql`CREATE SCHEMA public;`);
    console.log("Schema reset successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error resetting schema:", error);
    process.exit(1);
  }
}

main();
