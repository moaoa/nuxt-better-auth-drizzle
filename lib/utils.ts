import type { Updater } from "@tanstack/vue-table";
import { type ClassValue, clsx } from "clsx";
import { desc, Table, type AnyColumn, type SQLWrapper } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function tw(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function valueUpdater<T extends Updater<any>>(
  updaterOrValue: T,
  ref: Ref
) {
  ref.value =
    typeof updaterOrValue === "function"
      ? updaterOrValue(ref.value)
      : updaterOrValue;
}

//TODO: type the db param
export async function getNextId(
  db: any,
  table: Table,
  column: SQLWrapper | AnyColumn
): Promise<number> {
  const lastRecord = await db
    .select()
    .from(table)
    .orderBy(desc(column))
    .limit(1);

  return (lastRecord?.at(0)?.id ?? 0) + 1;
}

export const serviceKeyRouteMap = {
  notion: "/app/services/connect/notion",
  quickbooks: "/app/services/connect/quickbooks",
};
