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

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

export const useDrizzle = () => {
  return drizzle(client, {
    schema,
    logger: {
      logQuery(query, params) {
        logger.info(query, params);
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
