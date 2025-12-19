export enum AutomationType {
  NotionDbToGoogleSheet = "notion_db_to_google_sheet",
  GoogleSheetToNotion = "google_sheet_to_notion",
}

export type ImportStatus = "pending" | "importing" | "completed" | "failed";

export interface Automation {
  id: number;
  uuid: string;
  name: string;
  is_active: boolean;
  import_status?: ImportStatus;
  import_started_at?: string | Date;
  import_completed_at?: string | Date;
  import_total_rows?: number;
  import_processed_rows?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}
