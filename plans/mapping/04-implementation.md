# Notion to Google Sheets - Implementation Guide

## Database Schema Additions

### New Tables

Add to `db/schema.ts`:

```typescript
export const notionSheetsMapping = pgTable("notion_sheets_mapping", {
  id: serial("id").primaryKey().notNull(),
  automationId: integer("automation_id")
    .notNull()
    .references(() => automation.id, { onDelete: "cascade" }),
  mappingConfig: jsonb("mapping_config").notNull(), // MappingConfig JSON
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notionSheetsRowMapping = pgTable(
  "notion_sheets_row_mapping",
  {
    id: serial("id").primaryKey().notNull(),
    automationId: integer("automation_id")
      .notNull()
      .references(() => automation.id, { onDelete: "cascade" }),
    notionPageId: uuid("notion_page_id").notNull(),
    sheetRowNumber: integer("sheet_row_number").notNull(),
    checksum: text("checksum"),
    lastSyncedAt: timestamp("last_synced_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueMapping: unique().on(table.automationId, table.notionPageId),
  })
);
```

### Migration

Create migration file `db/migrations/XXXX_add_notion_sheets_mapping.sql`:

```sql
CREATE TABLE notion_sheets_mapping (
  id SERIAL PRIMARY KEY,
  automation_id INTEGER NOT NULL REFERENCES automation(id) ON DELETE CASCADE,
  mapping_config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE notion_sheets_row_mapping (
  id SERIAL PRIMARY KEY,
  automation_id INTEGER NOT NULL REFERENCES automation(id) ON DELETE CASCADE,
  notion_page_id UUID NOT NULL,
  sheet_row_number INTEGER NOT NULL,
  checksum TEXT,
  last_synced_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(automation_id, notion_page_id)
);

CREATE INDEX idx_row_mapping_automation ON notion_sheets_row_mapping(automation_id);
CREATE INDEX idx_row_mapping_page ON notion_sheets_row_mapping(notion_page_id);
```

## Types

Create `types/mapping.ts`:

```typescript
export interface ColumnMapping {
  notionPropertyId: string;
  notionPropertyName: string;
  notionPropertyType: NotionPropertyType;
  sheetColumnIndex: number;
  sheetColumnLetter: string;
  transformOptions?: TransformOptions;
}

export interface TransformOptions {
  dateFormat?: string;
  numberFormat?: string;
  includeTime?: boolean;
  delimiter?: string;
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
```

## Property Transformer Service

Create `server/services/propertyTransformer.ts`:

```typescript
import type { NotionPropertyType } from "~~/types/mapping";

type PropertyValue = any; // Notion API property value

export class PropertyTransformer {
  transform(type: NotionPropertyType, value: PropertyValue): string | number | boolean {
    const transformer = this.getTransformer(type);
    return transformer(value);
  }

  private getTransformer(type: NotionPropertyType): (value: PropertyValue) => string | number | boolean {
    const transformers: Record<NotionPropertyType, (v: PropertyValue) => string | number | boolean> = {
      title: this.transformTitle,
      rich_text: this.transformRichText,
      number: this.transformNumber,
      select: this.transformSelect,
      multi_select: this.transformMultiSelect,
      date: this.transformDate,
      people: this.transformPeople,
      files: this.transformFiles,
      checkbox: this.transformCheckbox,
      url: this.transformUrl,
      email: this.transformEmail,
      phone_number: this.transformPhoneNumber,
      formula: this.transformFormula,
      relation: this.transformRelation,
      rollup: this.transformRollup,
      created_time: this.transformCreatedTime,
      created_by: this.transformCreatedBy,
      last_edited_time: this.transformLastEditedTime,
      last_edited_by: this.transformLastEditedBy,
      status: this.transformStatus,
      unique_id: this.transformUniqueId,
    };

    return transformers[type] ?? (() => "");
  }

  private transformTitle(value: PropertyValue): string {
    return value?.title?.map((t: any) => t.plain_text).join("") ?? "";
  }

  private transformRichText(value: PropertyValue): string {
    return value?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
  }

  private transformNumber(value: PropertyValue): number {
    return value?.number ?? 0;
  }

  private transformSelect(value: PropertyValue): string {
    return value?.select?.name ?? "";
  }

  private transformMultiSelect(value: PropertyValue): string {
    return value?.multi_select?.map((o: any) => o.name).join(", ") ?? "";
  }

  private transformDate(value: PropertyValue): string {
    if (!value?.date) return "";
    const { start, end } = value.date;
    return end ? `${start} → ${end}` : start;
  }

  private transformPeople(value: PropertyValue): string {
    return value?.people?.map((p: any) => p.name ?? p.id).join(", ") ?? "";
  }

  private transformFiles(value: PropertyValue): string {
    return value?.files?.map((f: any) => f.file?.url ?? f.external?.url ?? "").join(", ") ?? "";
  }

  private transformCheckbox(value: PropertyValue): boolean {
    return value?.checkbox ?? false;
  }

  private transformUrl(value: PropertyValue): string {
    return value?.url ?? "";
  }

  private transformEmail(value: PropertyValue): string {
    return value?.email ?? "";
  }

  private transformPhoneNumber(value: PropertyValue): string {
    return value?.phone_number ?? "";
  }

  private transformFormula(value: PropertyValue): string | number | boolean {
    const formula = value?.formula;
    if (!formula) return "";
    
    switch (formula.type) {
      case "string": return formula.string ?? "";
      case "number": return formula.number ?? 0;
      case "boolean": return formula.boolean ?? false;
      case "date": return formula.date?.start ?? "";
      default: return "";
    }
  }

  private transformRelation(value: PropertyValue): string {
    // Note: Full relation resolution requires additional API calls
    return value?.relation?.map((r: any) => r.id).join(", ") ?? "";
  }

  private transformRollup(value: PropertyValue): string | number {
    const rollup = value?.rollup;
    if (!rollup) return "";
    
    switch (rollup.type) {
      case "number": return rollup.number ?? 0;
      case "date": return rollup.date?.start ?? "";
      case "array": return rollup.array?.length?.toString() ?? "0";
      default: return "";
    }
  }

  private transformCreatedTime(value: PropertyValue): string {
    return value?.created_time ?? "";
  }

  private transformCreatedBy(value: PropertyValue): string {
    return value?.created_by?.name ?? value?.created_by?.id ?? "";
  }

  private transformLastEditedTime(value: PropertyValue): string {
    return value?.last_edited_time ?? "";
  }

  private transformLastEditedBy(value: PropertyValue): string {
    return value?.last_edited_by?.name ?? value?.last_edited_by?.id ?? "";
  }

  private transformStatus(value: PropertyValue): string {
    return value?.status?.name ?? "";
  }

  private transformUniqueId(value: PropertyValue): string {
    const uid = value?.unique_id;
    if (!uid) return "";
    return uid.prefix ? `${uid.prefix}-${uid.number}` : String(uid.number);
  }
}

export const propertyTransformer = new PropertyTransformer();
```

## Mapping Sync Queue

Create `server/queues/mappingSyncQueue.ts`:

```typescript
import { Queue, Worker, QueueEvents } from "bullmq";
import { BullMQOtel } from "bullmq-otel";
import { Client } from "@notionhq/client";
import { google } from "googleapis";
import { useDrizzle } from "~~/server/utils/drizzle";
import { 
  automation, 
  notionAccount, 
  googleSheetsAccount,
  notionEntity,
  notionSheetsMapping,
  notionSheetsRowMapping 
} from "~~/db/schema";
import { eq, and } from "drizzle-orm";
import { propertyTransformer } from "~~/server/services/propertyTransformer";
import type { 
  MappingSyncJobData, 
  MappingSyncJobResult,
  MappingConfig 
} from "~~/types/mapping";
import { createHash } from "crypto";

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
};

export const MAPPING_SYNC_QUEUE_NAME = "mapping-sync-queue";

export const mappingSyncQueue = new Queue<MappingSyncJobData>(
  MAPPING_SYNC_QUEUE_NAME,
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
    telemetry: new BullMQOtel("mapping-sync-queue"),
  }
);

export const addMappingSyncJob = async (data: MappingSyncJobData) => {
  const jobId = `mapping-sync-${data.automationId}-${data.syncType}-${Date.now()}`;
  return mappingSyncQueue.add("process-mapping-sync", data, { jobId });
};

export const mappingSyncQueueEvents = new QueueEvents(MAPPING_SYNC_QUEUE_NAME, {
  connection,
});

function computeChecksum(row: (string | number | boolean)[]): string {
  const normalized = JSON.stringify(row);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export const mappingSyncWorker = new Worker<MappingSyncJobData, MappingSyncJobResult>(
  MAPPING_SYNC_QUEUE_NAME,
  async (job) => {
    const { automationId, syncType } = job.data;
    const db = useDrizzle();

    let rowsProcessed = 0;
    let rowsCreated = 0;
    let rowsUpdated = 0;
    let rowsDeleted = 0;

    try {
      // 1. Load automation config
      const automationRecord = await db.query.automation.findFirst({
        where: eq(automation.id, automationId),
      });

      if (!automationRecord) {
        throw new Error(`Automation ${automationId} not found`);
      }

      // 2. Load mapping config
      const mappingRecord = await db.query.notionSheetsMapping.findFirst({
        where: eq(notionSheetsMapping.automationId, automationId),
      });

      if (!mappingRecord) {
        throw new Error(`Mapping config for automation ${automationId} not found`);
      }

      const mappingConfig = mappingRecord.mappingConfig as MappingConfig;

      // 3. Get Notion client
      const notionAccountRecord = await db.query.notionAccount.findFirst({
        where: eq(notionAccount.id, automationRecord.notionAccountId!),
      });

      if (!notionAccountRecord) {
        throw new Error("Notion account not found");
      }

      const notion = new Client({ auth: notionAccountRecord.access_token });

      // 4. Get Google Sheets client
      const sheetsAccountRecord = await db.query.googleSheetsAccount.findFirst({
        where: eq(googleSheetsAccount.id, automationRecord.googleSheetsAccountId!),
      });

      if (!sheetsAccountRecord) {
        throw new Error("Google Sheets account not found");
      }

      const sheets = google.sheets({
        version: "v4",
        auth: sheetsAccountRecord.access_token,
      });

      // 5. Get the Notion database entity
      const notionDb = await db.query.notionEntity.findFirst({
        where: eq(notionEntity.id, automationRecord.notionEntityId!),
      });

      if (!notionDb) {
        throw new Error("Notion database entity not found");
      }

      // 6. Query Notion database pages
      const response = await notion.databases.query({
        database_id: notionDb.notionId,
      });

      const pages = response.results;
      rowsProcessed = pages.length;

      // 7. Transform pages to rows
      const rows: { pageId: string; values: (string | number | boolean)[] }[] = [];

      for (const page of pages) {
        if (page.object !== "page" || !("properties" in page)) continue;

        const rowValues: (string | number | boolean)[] = [];

        for (const column of mappingConfig.columns) {
          const property = page.properties[column.notionPropertyName];
          const value = property
            ? propertyTransformer.transform(column.notionPropertyType, property)
            : "";
          rowValues.push(value);
        }

        // Add Notion page ID if configured
        if (mappingConfig.includeNotionId) {
          rowValues.push(page.id);
        }

        rows.push({ pageId: page.id, values: rowValues });
      }

      // 8. Write to Google Sheets
      const spreadsheetId = automationRecord.googleSpreadSheetId;
      // Note: You'll need to resolve this to the actual Google spreadsheet ID

      if (syncType === "full") {
        // Clear existing data and write all rows
        const range = `${mappingConfig.sheetName}!A${mappingConfig.dataStartRow}:ZZ`;
        
        await sheets.spreadsheets.values.clear({
          spreadsheetId: String(spreadsheetId),
          range,
        });

        // Clear row mappings
        await db
          .delete(notionSheetsRowMapping)
          .where(eq(notionSheetsRowMapping.automationId, automationId));

        // Write all rows
        if (rows.length > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: String(spreadsheetId),
            range: `${mappingConfig.sheetName}!A${mappingConfig.dataStartRow}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: rows.map((r) => r.values),
            },
          });

          // Create row mappings
          const mappings = rows.map((row, index) => ({
            automationId,
            notionPageId: row.pageId,
            sheetRowNumber: mappingConfig.dataStartRow + index,
            checksum: computeChecksum(row.values),
            lastSyncedAt: new Date(),
          }));

          await db.insert(notionSheetsRowMapping).values(mappings);
          rowsCreated = rows.length;
        }
      } else {
        // Incremental sync - update only changed rows
        for (const row of rows) {
          const existingMapping = await db.query.notionSheetsRowMapping.findFirst({
            where: and(
              eq(notionSheetsRowMapping.automationId, automationId),
              eq(notionSheetsRowMapping.notionPageId, row.pageId)
            ),
          });

          const newChecksum = computeChecksum(row.values);

          if (existingMapping) {
            // Check if row changed
            if (existingMapping.checksum !== newChecksum) {
              await sheets.spreadsheets.values.update({
                spreadsheetId: String(spreadsheetId),
                range: `${mappingConfig.sheetName}!A${existingMapping.sheetRowNumber}`,
                valueInputOption: "USER_ENTERED",
                requestBody: { values: [row.values] },
              });

              await db
                .update(notionSheetsRowMapping)
                .set({ checksum: newChecksum, lastSyncedAt: new Date() })
                .where(eq(notionSheetsRowMapping.id, existingMapping.id));

              rowsUpdated++;
            }
          } else {
            // Append new row
            const appendResponse = await sheets.spreadsheets.values.append({
              spreadsheetId: String(spreadsheetId),
              range: `${mappingConfig.sheetName}!A${mappingConfig.dataStartRow}`,
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [row.values] },
            });

            // Extract the row number from the response
            const updatedRange = appendResponse.data.updates?.updatedRange;
            const rowNumber = updatedRange 
              ? parseInt(updatedRange.match(/\d+/)?.[0] ?? "0") 
              : mappingConfig.dataStartRow + rowsCreated;

            await db.insert(notionSheetsRowMapping).values({
              automationId,
              notionPageId: row.pageId,
              sheetRowNumber: rowNumber,
              checksum: newChecksum,
              lastSyncedAt: new Date(),
            });

            rowsCreated++;
          }
        }
      }

      // Update automation last_synced_at
      await db
        .update(automation)
        .set({ last_synced_at: new Date() })
        .where(eq(automation.id, automationId));

      return {
        status: "completed",
        message: `Sync completed for automation ${automationId}`,
        rowsProcessed,
        rowsCreated,
        rowsUpdated,
        rowsDeleted,
      };
    } catch (error: any) {
      console.error("Mapping sync failed:", error);
      throw new Error(`Mapping sync failed: ${error.message}`);
    }
  },
  {
    connection,
    telemetry: new BullMQOtel("mapping-sync-worker"),
    limiter: {
      max: 3,
      duration: 1000, // Respect Notion rate limits
    },
  }
);
```

## API Endpoint

Create `server/api/automations/[id]/sync.post.ts`:

```typescript
import { addMappingSyncJob } from "~~/server/queues/mappingSyncQueue";
import { useDrizzle } from "~~/server/utils/drizzle";
import { automation } from "~~/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, "id") ?? "");
  const body = await readBody<{ syncType?: "full" | "incremental" }>(event);

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: "Invalid automation ID" });
  }

  const db = useDrizzle();
  const automationRecord = await db.query.automation.findFirst({
    where: eq(automation.id, id),
  });

  if (!automationRecord) {
    throw createError({ statusCode: 404, message: "Automation not found" });
  }

  const job = await addMappingSyncJob({
    automationId: id,
    syncType: body.syncType ?? "incremental",
  });

  return {
    success: true,
    jobId: job.id,
    message: `Sync job queued for automation ${id}`,
  };
});
```

## Logging

Add to `lib/loggers/mapping.ts`:

```typescript
import winston from "winston";

const { format } = winston;

export const mappingLogger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: "mapping-sync" },
  transports: [
    new winston.transports.File({ filename: "logs/mapping-sync.log" }),
    new winston.transports.File({ 
      filename: "logs/mapping-sync-error.log", 
      level: "error" 
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  mappingLogger.add(
    new winston.transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    })
  );
}
```

## Integration with Existing Automation Table

The `automation` table already has the necessary foreign keys:

```typescript
// From db/schema.ts
notionAccountId: integer("notion_account_id").references(() => notionAccount.id),
googleSheetsAccountId: integer("google_sheets_account_id").references(() => googleSheetsAccount.id),
googleSpreadSheetId: integer("googleSpreadSheet_id").references(() => googleSpreadsheet.id),
notionEntityId: integer("notionEntity_id").references(() => notionEntity.id),
```

The new `notionSheetsMapping` table extends this with column mapping configuration.

## Summary

### Files to Create

1. `types/mapping.ts` - Type definitions
2. `server/services/propertyTransformer.ts` - Property transformation logic
3. `server/queues/mappingSyncQueue.ts` - BullMQ queue and worker
4. `server/api/automations/[id]/sync.post.ts` - API endpoint
5. `lib/loggers/mapping.ts` - Logging configuration

### Database Changes

1. Add `notion_sheets_mapping` table
2. Add `notion_sheets_row_mapping` table
3. Run migration

### Configuration

1. Set up mapping config when user creates automation
2. Store column mappings in `notion_sheets_mapping.mapping_config`
3. Track row positions in `notion_sheets_row_mapping`



