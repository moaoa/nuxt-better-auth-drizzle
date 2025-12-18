import { Queue, Worker, QueueEvents, Job } from "bullmq";
import { BullMQOtel } from "bullmq-otel";
import { google } from "googleapis";
import { useDrizzle } from "~~/server/utils/drizzle";
import {
  automation,
  notionAccount,
  googleSheetsAccount,
  googleSpreadsheet,
  notionEntity,
  notionSheetsMapping,
  notionSheetsRowMapping,
} from "~~/db/schema";
import { eq, and } from "drizzle-orm";
import { propertyTransformer } from "~~/server/services/propertyTransformer";
import type { MappingConfig, ColumnMapping } from "~~/types/mapping";
import { createHash } from "crypto";

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
};

export const MAPPING_SYNC_QUEUE_NAME = "mapping-sync-queue";

export const mappingSyncQueue = new Queue(MAPPING_SYNC_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
  telemetry: new BullMQOtel("mapping-sync-queue"),
});

/**
 * Job data for mapping sync (triggered after Notion page fetch)
 */
export interface MappingSyncJobData {
  automationId: number;
  syncType: "full" | "incremental";
  pageId?: string; // For incremental sync of a single page
  deletedPageId?: string; // For handling deleted pages
}

export interface MappingSyncJobResult {
  status: "completed" | "failed";
  message?: string;
  rowsProcessed: number;
  rowsCreated: number;
  rowsUpdated: number;
  rowsDeleted: number;
}

/**
 * Add a mapping sync job to the queue
 */
export const addMappingSyncJob = async (data: MappingSyncJobData) => {
  const jobId = `mapping-sync-${data.automationId}-${data.syncType}-${Date.now()}`;
  return mappingSyncQueue.add("process-mapping-sync", data, { jobId });
};

export const mappingSyncQueueEvents = new QueueEvents(MAPPING_SYNC_QUEUE_NAME, {
  connection,
});

/**
 * Compute a checksum for a row to detect changes
 */
function computeChecksum(row: (string | number | boolean)[]): string {
  const normalized = JSON.stringify(row);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Transform a Notion page to a row of values based on mapping config
 */
function transformPageToRow(
  page: any,
  columns: ColumnMapping[]
): (string | number | boolean)[] {
  const rowValues: (string | number | boolean)[] = [];

  for (const column of columns) {
    const property = page.properties?.[column.notionPropertyName];
    const value = property
      ? propertyTransformer.transform(column.notionPropertyType, property)
      : "";
    rowValues.push(value);
  }

  return rowValues;
}

/**
 * Worker for syncing Notion data to Google Sheets
 */
export const mappingSyncWorker = new Worker<
  MappingSyncJobData,
  MappingSyncJobResult
>(
  MAPPING_SYNC_QUEUE_NAME,
  async (job: Job<MappingSyncJobData>) => {
    const { automationId, syncType, pageId, deletedPageId } = job.data;
    const db = useDrizzle();

    let rowsProcessed = 0;
    let rowsCreated = 0;
    let rowsUpdated = 0;
    let rowsDeleted = 0;

    try {
      console.log(
        `Processing mapping sync job for automation ${automationId}, type: ${syncType}`
      );

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
        throw new Error(
          `Mapping config for automation ${automationId} not found`
        );
      }

      const mappingConfig = mappingRecord.mappingConfig as MappingConfig;

      // 3. Get Google Sheets account
      if (!automationRecord.googleSheetsAccountId) {
        throw new Error(`Automation ${automationId} has no Google Sheets account`);
      }

      const sheetsAccount = await db.query.googleSheetsAccount.findFirst({
        where: eq(googleSheetsAccount.id, automationRecord.googleSheetsAccountId),
      });

      if (!sheetsAccount) {
        throw new Error("Google Sheets account not found");
      }

      // 4. Get the Google Spreadsheet
      if (!automationRecord.googleSpreadSheetId) {
        throw new Error(`Automation ${automationId} has no Google Spreadsheet`);
      }

      const spreadsheetRecord = await db.query.googleSpreadsheet.findFirst({
        where: eq(googleSpreadsheet.id, automationRecord.googleSpreadSheetId),
      });

      if (!spreadsheetRecord) {
        throw new Error("Google Spreadsheet not found");
      }

      // 5. Initialize Google Sheets API
      const sheets = google.sheets({
        version: "v4",
        auth: sheetsAccount.access_token,
      });

      const spreadsheetId = spreadsheetRecord.googleSpreadsheetId;

      // Handle deleted page
      if (deletedPageId) {
        const existingMapping = await db.query.notionSheetsRowMapping.findFirst(
          {
            where: and(
              eq(notionSheetsRowMapping.automationId, automationId),
              eq(notionSheetsRowMapping.notionPageId, deletedPageId)
            ),
          }
        );

        if (existingMapping) {
          // Clear the row in Google Sheets (set to empty)
          const range = `${mappingConfig.sheetName}!A${existingMapping.sheetRowNumber}:ZZ${existingMapping.sheetRowNumber}`;
          await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range,
          });

          // Delete the row mapping
          await db
            .delete(notionSheetsRowMapping)
            .where(eq(notionSheetsRowMapping.id, existingMapping.id));

          rowsDeleted = 1;
        }

        return {
          status: "completed",
          message: `Deleted row for page ${deletedPageId}`,
          rowsProcessed: 1,
          rowsCreated: 0,
          rowsUpdated: 0,
          rowsDeleted,
        };
      }

      // Handle single page sync (incremental from webhook)
      if (pageId && syncType === "incremental") {
        const entity = await db.query.notionEntity.findFirst({
          where: eq(notionEntity.notionId, pageId),
        });

        if (!entity) {
          throw new Error(`Notion entity ${pageId} not found in database`);
        }

        const pageData = entity.propertiesJson as any;
        const rowValues = transformPageToRow(pageData, mappingConfig.columns);

        // Add Notion page ID if configured
        if (mappingConfig.includeNotionId) {
          rowValues.push(pageId);
        }

        const newChecksum = computeChecksum(rowValues);
        rowsProcessed = 1;

        // Check if row exists
        const existingMapping = await db.query.notionSheetsRowMapping.findFirst(
          {
            where: and(
              eq(notionSheetsRowMapping.automationId, automationId),
              eq(notionSheetsRowMapping.notionPageId, pageId)
            ),
          }
        );

        if (existingMapping) {
          // Check if row changed
          if (existingMapping.checksum !== newChecksum) {
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${mappingConfig.sheetName}!A${existingMapping.sheetRowNumber}`,
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [rowValues] },
            });

            await db
              .update(notionSheetsRowMapping)
              .set({ checksum: newChecksum, lastSyncedAt: new Date() })
              .where(eq(notionSheetsRowMapping.id, existingMapping.id));

            rowsUpdated = 1;
          }
        } else {
          // Append new row
          const appendResponse = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${mappingConfig.sheetName}!A${mappingConfig.dataStartRow}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [rowValues] },
          });

          // Extract the row number from the response
          const updatedRange = appendResponse.data.updates?.updatedRange;
          const rowNumber = updatedRange
            ? parseInt(updatedRange.match(/\d+/)?.[0] ?? "0")
            : mappingConfig.dataStartRow;

          await db.insert(notionSheetsRowMapping).values({
            automationId,
            notionPageId: pageId,
            sheetRowNumber: rowNumber,
            checksum: newChecksum,
            lastSyncedAt: new Date(),
          });

          rowsCreated = 1;
        }

        // Update automation last_synced_at
        await db
          .update(automation)
          .set({ last_synced_at: new Date() })
          .where(eq(automation.id, automationId));

        return {
          status: "completed",
          message: `Synced page ${pageId} to Google Sheets`,
          rowsProcessed,
          rowsCreated,
          rowsUpdated,
          rowsDeleted,
        };
      }

      // Full sync - not implemented in this webhook-driven flow
      // Would need to fetch all pages and rebuild the sheet
      return {
        status: "completed",
        message: "Full sync not implemented in webhook flow",
        rowsProcessed: 0,
        rowsCreated: 0,
        rowsUpdated: 0,
        rowsDeleted: 0,
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
      max: 300,
      duration: 60000, // 300 requests per minute (Google Sheets rate limit)
    },
  }
);

