import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getMigrationsFolder } from "~~/db/migrations-path";
import { useDrizzle } from "~~/server/utils/drizzle";

const db = useDrizzle();

await migrate(db, { migrationsFolder: getMigrationsFolder() });
