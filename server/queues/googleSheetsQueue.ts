import { Queue, QueueEvents, Worker, Job } from "bullmq";
import { BullMQOtel } from "bullmq-otel";
import { google } from "googleapis";
import { useDrizzle } from "~~/server/utils/drizzle";
import {
  googleSpreadsheet,
  automation,
  googleSheetsAccount,
  notionEntity,
  notionSheetsMapping,
  notionSheetsRowMapping,
} from "~~/db/schema";
import { eq, and } from "drizzle-orm";
import { propertyTransformer } from "~~/server/services/propertyTransformer";
import type { MappingConfig, ColumnMapping } from "~~/types/mapping";
import { createHash } from "crypto";
import winston from "winston";

const { format } = winston;

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [new winston.transports.File({ filename: "google-sheets.log" })],
});

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
};

/**
 * Job data for listing spreadsheets (metadata sync)
 */
export interface GoogleSheetsListJobData {
  jobType: "list-spreadsheets";
  userId: string;
  accessToken: string;
  refreshToken: string;
  pageToken?: string;
}

/**
 * Job data for writing a row to Google Sheets
 */
export interface GoogleSheetsWriteRowJobData {
  jobType: "write-row";
  automationId: number;
  notionPageId: string;
}

/**
 * Job data for deleting a row from Google Sheets
 */
export interface GoogleSheetsDeleteRowJobData {
  jobType: "delete-row";
  automationId: number;
  notionPageId: string;
}

/**
 * Union type for all Google Sheets job data
 */
export type GoogleSheetsJobData =
  | GoogleSheetsListJobData
  | GoogleSheetsWriteRowJobData
  | GoogleSheetsDeleteRowJobData;

export interface GoogleSheetsJobResult {
  status: "completed" | "failed";
  message?: string;
  nextPageToken?: string | null;
  rowsProcessed?: number;
  rowsCreated?: number;
  rowsUpdated?: number;
  rowsDeleted?: number;
}

console.log(connection);

export const GOOGLE_SHEETS_QUEUE_NAME = "google-sheets-queue";

export const googleSheetsQueue = new Queue<GoogleSheetsJobData>(
  GOOGLE_SHEETS_QUEUE_NAME,
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
    telemetry: new BullMQOtel("google-sheets-queue"),
  }
);

/**
 * Add a job to list Google Sheets (metadata sync)
 */
export const addGoogleSheetsListJob = async (
  data: Omit<GoogleSheetsListJobData, "jobType">
) => {
  const page = data.pageToken || "initial";
  return googleSheetsQueue.add(
    "list-spreadsheets",
    { ...data, jobType: "list-spreadsheets" },
    {
      jobId: `fetch-googlesheets-${data.userId}-${page}`,
    }
  );
};

/**
 * Add a job to write a row to Google Sheets
 */
export const addGoogleSheetsWriteRowJob = async (
  data: Omit<GoogleSheetsWriteRowJobData, "jobType">
) => {
  const jobId = `write-row-${data.automationId}-${data.notionPageId}-${Date.now()}`;
  return googleSheetsQueue.add(
    "write-row",
    { ...data, jobType: "write-row" },
    { jobId }
  );
};

/**
 * Add a job to delete a row from Google Sheets
 */
export const addGoogleSheetsDeleteRowJob = async (
  data: Omit<GoogleSheetsDeleteRowJobData, "jobType">
) => {
  const jobId = `delete-row-${data.automationId}-${data.notionPageId}-${Date.now()}`;
  return googleSheetsQueue.add(
    "delete-row",
    { ...data, jobType: "delete-row" },
    { jobId }
  );
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use addGoogleSheetsListJob instead
 */
export const addGoogleSheetsJob = async (
  data: Omit<GoogleSheetsListJobData, "jobType">
) => {
  return addGoogleSheetsListJob(data);
};

export const googleSheetsQueueEvents = new QueueEvents(
  GOOGLE_SHEETS_QUEUE_NAME,
  {
    connection,
  }
);

googleSheetsQueueEvents.on("completed", async ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed`);
  const job = await googleSheetsQueue.getJob(jobId);
  if (job && returnvalue && job.data.jobType === "list-spreadsheets") {
    const newData = { ...job.data, pageToken: returnvalue.nextPageToken };
    await addGoogleSheetsListJob(newData);
  }
});

googleSheetsQueueEvents.on("failed", async ({ jobId, failedReason }) => {
  console.log(`Job ${jobId} failed`);
  console.log(`Failed reason: ${failedReason}`);
});

googleSheetsQueueEvents.on("error", async ({ message, name }) => {
  console.log(`Error with google sheets queue: ${message}`);
  console.log(`Error name: ${name}`);
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

export const googleSheetsWorker = new Worker<
  GoogleSheetsJobData,
  GoogleSheetsJobResult
>(
  GOOGLE_SHEETS_QUEUE_NAME,
  async (job) => {
    const db = useDrizzle();

    // Handle list-spreadsheets job (metadata sync)
    if (job.data.jobType === "list-spreadsheets") {
      const { userId, accessToken } = job.data;

      console.log(`Processing Google Sheets list job for user ${userId}`);

      try {
        const drive = google.drive({ version: "v3", auth: accessToken });

        const response = await drive.files.list({
          q: "mimeType='application/vnd.google-apps.spreadsheet'",
          fields: "nextPageToken,files(id,name,exportLinks)",
          access_token: accessToken,
        });

        console.log("response from google drive files: ", response);
        logger.info(response);

        const apiSpreadsheets = response.data.files || [];
        const nextPageToken = response.data.nextPageToken;

        if (apiSpreadsheets.length === 0 && !nextPageToken) {
          console.log("No spreadsheets found for user:", userId);
          // if no spreadsheets found, delete all existing ones for the user
          await db
            .delete(googleSpreadsheet)
            .where(eq(googleSpreadsheet.userId, userId));
          return {
            status: "completed",
            message: "No spreadsheets found, all existing records deleted.",
          };
        }

        const existingDBSpreadsheets =
          await db.query.googleSpreadsheet.findMany({
            where: eq(googleSpreadsheet.userId, userId),
          });

        const existingSheetsMap = new Map(
          existingDBSpreadsheets.map((sheet) => [
            sheet.googleSpreadsheetId,
            sheet,
          ])
        );

        const spreadsheetUpserts: (typeof googleSpreadsheet.$inferInsert)[] =
          [];

        for (const apiSheet of apiSpreadsheets) {
          const url =
            apiSheet["exportLinks"]?.[
              "application/x-vnd.oasis.opendocument.spreadsheet"
            ];
          if (!apiSheet.id || !apiSheet.name || !url) continue;

          const existingSheet = existingSheetsMap.get(apiSheet.id);

          spreadsheetUpserts.push({
            url,
            userId: userId,
            title: apiSheet.name,
            googleSpreadsheetId: apiSheet.id,
            updatedAt: new Date(),
            createdAt: existingSheet ? existingSheet.createdAt : new Date(),
          });
        }

        await db
          .insert(googleSpreadsheet)
          .values(spreadsheetUpserts)
          .onConflictDoUpdate({
            target: [
              googleSpreadsheet.googleSpreadsheetId,
              googleSpreadsheet.userId,
            ],
            set: {
              title: googleSpreadsheet.title,
              updatedAt: googleSpreadsheet.updatedAt,
            },
          });

        return {
          status: "completed",
          message: `Google Sheets sync completed. Added: ${spreadsheetUpserts.length}`,
          nextPageToken,
        };
      } catch (error: any) {
        console.error("Google Sheets list sync failed:", error);
        throw new Error(`Google Sheets list sync failed: ${error.message}`);
      }
    }

    // Handle write-row job (write/update a row in Google Sheets)
    if (job.data.jobType === "write-row") {
      const { automationId, notionPageId } = job.data;

      console.log(
        `Processing write-row job for automation ${automationId}, page ${notionPageId}`
      );

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
          throw new Error(
            `Mapping config for automation ${automationId} not found`
          );
        }

        const mappingConfig = mappingRecord.mappingConfig as MappingConfig;

        // 3. Get Google Sheets account
        if (!automationRecord.googleSheetsAccountId) {
          throw new Error(
            `Automation ${automationId} has no Google Sheets account`
          );
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

        // 5. Get Notion entity from database
        const entity = await db.query.notionEntity.findFirst({
          where: eq(notionEntity.notionId, notionPageId),
        });

        if (!entity) {
          throw new Error(`Notion entity ${notionPageId} not found in database`);
        }

        // 6. Initialize Google Sheets API
        const sheets = google.sheets({
          version: "v4",
          auth: sheetsAccount.access_token,
        });

        const spreadsheetId = spreadsheetRecord.googleSpreadsheetId;

        // 7. Transform page data to row values
        const pageData = entity.propertiesJson as any;
        const rowValues = transformPageToRow(pageData, mappingConfig.columns);

        // Add Notion page ID if configured
        if (mappingConfig.includeNotionId) {
          rowValues.push(notionPageId);
        }

        const newChecksum = computeChecksum(rowValues);

        // 8. Check if row exists
        const existingMapping = await db.query.notionSheetsRowMapping.findFirst(
          {
            where: and(
              eq(notionSheetsRowMapping.automationId, automationId),
              eq(notionSheetsRowMapping.notionPageId, notionPageId)
            ),
          }
        );

        let rowsCreated = 0;
        let rowsUpdated = 0;

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
              .set({
                checksum: newChecksum,
                lastSyncedAt: new Date(),
              })
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
            notionPageId: notionPageId,
            sheetRowNumber: rowNumber,
            checksum: newChecksum,
            lastSyncedAt: new Date(),
          });

          rowsCreated = 1;
        }

        // 9. Update automation last_synced_at
        await db
          .update(automation)
          .set({ last_synced_at: new Date() })
          .where(eq(automation.id, automationId));

        return {
          status: "completed",
          message: `Synced page ${notionPageId} to Google Sheets`,
          rowsProcessed: 1,
          rowsCreated,
          rowsUpdated,
          rowsDeleted: 0,
        };
      } catch (error: any) {
        console.error("Google Sheets write-row failed:", error);
        throw new Error(`Google Sheets write-row failed: ${error.message}`);
      }
    }

    // Handle delete-row job (delete/clear a row in Google Sheets)
    if (job.data.jobType === "delete-row") {
      const { automationId, notionPageId } = job.data;

      console.log(
        `Processing delete-row job for automation ${automationId}, page ${notionPageId}`
      );

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
          throw new Error(
            `Mapping config for automation ${automationId} not found`
          );
        }

        const mappingConfig = mappingRecord.mappingConfig as MappingConfig;

        // 3. Get Google Sheets account
        if (!automationRecord.googleSheetsAccountId) {
          throw new Error(
            `Automation ${automationId} has no Google Sheets account`
          );
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

        // 6. Find existing row mapping
        const existingMapping = await db.query.notionSheetsRowMapping.findFirst(
          {
            where: and(
              eq(notionSheetsRowMapping.automationId, automationId),
              eq(notionSheetsRowMapping.notionPageId, notionPageId)
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

          return {
            status: "completed",
            message: `Deleted row for page ${notionPageId}`,
            rowsProcessed: 1,
            rowsCreated: 0,
            rowsUpdated: 0,
            rowsDeleted: 1,
          };
        }

        return {
          status: "completed",
          message: `No row mapping found for page ${notionPageId}`,
          rowsProcessed: 0,
          rowsCreated: 0,
          rowsUpdated: 0,
          rowsDeleted: 0,
        };
      } catch (error: any) {
        console.error("Google Sheets delete-row failed:", error);
        throw new Error(`Google Sheets delete-row failed: ${error.message}`);
      }
    }

    throw new Error(`Unknown job type: ${(job.data as any).jobType}`);
  },
  {
    connection,
    telemetry: new BullMQOtel("google-sheets-worker"),
    limiter: {
      max: 300,
      duration: 60000, // 300 requests per minute (Google Sheets rate limit)
    },
  }
);
