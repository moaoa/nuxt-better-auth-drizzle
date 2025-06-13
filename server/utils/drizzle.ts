import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

export const useDrizzle = () => {
  return drizzle(client, { schema });
};

export const tables = schema;

export type User = schema.User;
export const UserInsert = schema.user.$inferInsert;
export type UserRegisterType = Omit<
  typeof UserInsert,
  "createdAt" | "updatedAt" | "id" | "emailVerified"
>;
