import { service } from "~~/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type Service = InferSelectModel<typeof service>;

export const serviceKeys = ["quickbooks", "google_sheet", "notion"] as const;

export type ServiceKey = typeof serviceKeys[number];
