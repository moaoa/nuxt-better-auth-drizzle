import { automationType } from "~~/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type Service = InferSelectModel<typeof automationType>;

export const serviceKeys = ["quickbooks", "google_sheet", "notion"] as const;

export type ServiceKey = (typeof serviceKeys)[number];
