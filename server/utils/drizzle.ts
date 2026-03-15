import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";
import winston from "winston";

const { format } = winston;

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [new winston.transports.File({ filename: "drizzle.log" })],
});

/**
 * Constructs the database connection string from separate environment variables or uses DATABASE_URL if provided.
 * Falls back to constructing from DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME if DATABASE_URL is not set.
 */
function getConnectionString(): string {
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

const connectionString = getConnectionString();
const client = postgres(connectionString);

export const useDrizzle = () => {
  return drizzle(client, {
    schema,
    logger: {
      logQuery(query, params) {
        logger.info({ query, params });
      },
    },
  });
};

export const tables = schema;

export type User = schema.User;
export const UserInsert = schema.user.$inferInsert;
export type UserRegisterType = Omit<
  typeof UserInsert,
  "createdAt" | "updatedAt" | "id" | "emailVerified"
>;
