import { service } from "~~/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type Service = InferSelectModel<typeof service>;
