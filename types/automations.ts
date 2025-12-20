import type { InferSelectModel } from "drizzle-orm";
import type { automation } from "~~/db/schema";

export enum AutomationType {
  NotionDbToGoogleSheet = "notion_db_to_google_sheet",
  GoogleSheetToNotion = "google_sheet_to_notion",
}

export type ImportStatus = "pending" | "importing" | "completed" | "failed";

// Infer the full automation type from the schema
type AutomationTable = InferSelectModel<typeof automation>;

// Pick only the public fields that the frontend can see
export type Automation = Pick<
  AutomationTable,
  | "uuid"
  | "name"
  | "is_active"
  | "import_status"
  | "import_started_at"
  | "import_completed_at"
  | "import_total_rows"
  | "import_processed_rows"
  | "createdAt"
  | "updatedAt"
>;
