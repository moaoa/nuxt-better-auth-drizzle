import { migrate } from "drizzle-orm/postgres-js/migrator";
import config from "~~/config/drizzle.config";
import { useDrizzle } from "~~/server/utils/drizzle";

const db = useDrizzle();

await migrate(db, { migrationsFolder: config.out! });
