/**
 * Type definitions for Notion to Google Sheets mapping
 */

export type NotionPropertyType =
  | "title"
  | "rich_text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "people"
  | "files"
  | "checkbox"
  | "url"
  | "email"
  | "phone_number"
  | "formula"
  | "relation"
  | "rollup"
  | "created_time"
  | "created_by"
  | "last_edited_time"
  | "last_edited_by"
  | "status"
  | "unique_id";

export interface TransformOptions {
  dateFormat?: string;
  numberFormat?: string;
  includeTime?: boolean;
  delimiter?: string;
}

export interface ColumnMapping {
  notionPropertyId: string;
  notionPropertyName: string;
  notionPropertyType: NotionPropertyType;
  sheetColumnIndex: number;
  sheetColumnLetter: string;
  transformOptions?: TransformOptions;
}

export interface MappingConfig {
  automationId: number;
  headerRow: number;
  dataStartRow: number;
  columns: ColumnMapping[];
  includeNotionId: boolean;
  includeLastSync: boolean;
  sheetName: string;
}

export interface MappingSyncJobData {
  automationId: number;
  syncType: "full" | "incremental";
  cursor?: string;
}

export interface MappingSyncJobResult {
  status: "completed" | "failed";
  message?: string;
  rowsProcessed: number;
  rowsCreated: number;
  rowsUpdated: number;
  rowsDeleted: number;
}

