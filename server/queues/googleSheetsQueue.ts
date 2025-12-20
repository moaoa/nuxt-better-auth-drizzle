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
} from "~~/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
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
 * Get Google Sheets OAuth2 configuration from environment variables
 * Best practice for Nuxt.js: Use process.env directly in server-side workers
 * since they run outside the Nuxt request context
 */
function getGoogleSheetsOAuthConfig() {
  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SHEETS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Sheets OAuth configuration missing. Please set GOOGLE_SHEETS_CLIENT_ID and GOOGLE_SHEETS_CLIENT_SECRET environment variables."
    );
  }

  return {
    clientId,
    clientSecret,
  };
}

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
  eventType?: string; // e.g., "page.created", "page.content_updated", "page.properties_updated"
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
 * Job data for writing headers to Google Sheets
 */
export interface GoogleSheetsWriteHeadersJobData {
  jobType: "write-headers";
  automationId: number;
  headers: string[]; // Array of header names in order
}

/**
 * Union type for all Google Sheets job data
 */
export type GoogleSheetsJobData =
  | GoogleSheetsListJobData
  | GoogleSheetsWriteRowJobData
  | GoogleSheetsDeleteRowJobData
  | GoogleSheetsWriteHeadersJobData;

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
  const jobId = `write-row-${data.automationId}-${
    data.notionPageId
  }-${Date.now()}`;
  return googleSheetsQueue.add(
    "write-row",
    { ...data, jobType: "write-row" },
    { jobId }
  );
};

/**
 * Add a job to write headers to Google Sheets
 */
export const addGoogleSheetsWriteHeadersJob = async (
  data: Omit<GoogleSheetsWriteHeadersJobData, "jobType">
) => {
  const jobId = `write-headers-${data.automationId}-${Date.now()}`;
  return googleSheetsQueue.add(
    "write-headers",
    { ...data, jobType: "write-headers" },
    { jobId }
  );
};

/**
 * Add a job to delete a row from Google Sheets
 */
export const addGoogleSheetsDeleteRowJob = async (
  data: Omit<GoogleSheetsDeleteRowJobData, "jobType">
) => {
  const jobId = `delete-row-${data.automationId}-${
    data.notionPageId
  }-${Date.now()}`;
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
  if (
    job &&
    returnvalue &&
    typeof returnvalue === "object" &&
    "nextPageToken" in returnvalue &&
    job.data.jobType === "list-spreadsheets"
  ) {
    const result = returnvalue as GoogleSheetsJobResult;
    const newData = {
      ...job.data,
      pageToken: result.nextPageToken ?? undefined,
    };
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

    // Handle write-headers job (write headers to Google Sheets)
    if (job.data.jobType === "write-headers") {
      const { automationId, headers } = job.data;

      console.log(
        `Processing write-headers job for automation ${automationId} with ${headers.length} headers`
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
          where: eq(
            googleSheetsAccount.id,
            automationRecord.googleSheetsAccountId
          ),
        });

        if (!sheetsAccount) {
          throw new Error("Google Sheets account not found");
        }

        // 4. Get the Google Spreadsheet
        if (!automationRecord.googleSpreadSheetId) {
          throw new Error(
            `Automation ${automationId} has no Google Spreadsheet`
          );
        }

        const spreadsheetRecord = await db.query.googleSpreadsheet.findFirst({
          where: eq(googleSpreadsheet.id, automationRecord.googleSpreadSheetId),
        });

        if (!spreadsheetRecord) {
          throw new Error("Google Spreadsheet not found");
        }

        // 5. Initialize Google Sheets API with OAuth2Client
        const oauthConfig = getGoogleSheetsOAuthConfig();
        const oauth2Client = new google.auth.OAuth2(
          oauthConfig.clientId,
          oauthConfig.clientSecret
        );

        // Set the credentials with the access token
        oauth2Client.setCredentials({
          access_token: sheetsAccount.access_token,
          refresh_token: sheetsAccount.refresh_token,
        });

        const sheets = google.sheets({
          version: "v4",
          auth: oauth2Client,
        });

        const spreadsheetId = spreadsheetRecord.googleSpreadsheetId;
        const sheetName = mappingConfig.sheetName || "Sheet1";
        const headerRow = mappingConfig.headerRow || 1;

        // 6. Build header row values
        // Headers should be in the order of columns, plus UUID column at the end if includeNotionId is true
        const headerValues: string[] = headers;

        // Add UUID column header at the end if includeNotionId is true
        if (mappingConfig.includeNotionId) {
          headerValues.push("Notion UUID");
        }

        // 7. Write headers to Google Sheets
        const range = `${sheetName}!${headerRow}:${headerRow}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [headerValues] },
        });

        logger.info(
          `Headers written to Google Sheets for automation ${automationId}: ${headerValues.join(
            ", "
          )}`
        );

        return {
          status: "completed",
          message: `Headers written to Google Sheets for automation ${automationId}`,
        };
      } catch (error: any) {
        console.error("Google Sheets write-headers failed:", error);
        throw new Error(`Google Sheets write-headers failed: ${error.message}`);
      }
    }

    // Handle write-row job (write/update a row in Google Sheets)
    if (job.data.jobType === "write-row") {
      const { automationId, notionPageId, eventType } = job.data;
      const isNewRow = eventType === "page.created";

      console.log(
        `Processing write-row job for automation ${automationId}, page ${notionPageId}, event: ${
          eventType || "unknown"
        }`
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
          where: eq(
            googleSheetsAccount.id,
            automationRecord.googleSheetsAccountId
          ),
        });

        if (!sheetsAccount) {
          throw new Error("Google Sheets account not found");
        }

        // 4. Get the Google Spreadsheet
        if (!automationRecord.googleSpreadSheetId) {
          throw new Error(
            `Automation ${automationId} has no Google Spreadsheet`
          );
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
          throw new Error(
            `Notion entity ${notionPageId} not found in database`
          );
        }

        // 6. Initialize Google Sheets API with OAuth2Client
        const oauthConfig = getGoogleSheetsOAuthConfig();
        const oauth2Client = new google.auth.OAuth2(
          oauthConfig.clientId,
          oauthConfig.clientSecret
        );

        // Set the credentials with the access token
        oauth2Client.setCredentials({
          access_token: sheetsAccount.access_token,
          refresh_token: sheetsAccount.refresh_token,
        });

        const sheets = google.sheets({
          version: "v4",
          auth: oauth2Client,
        });

        const spreadsheetId = spreadsheetRecord.googleSpreadsheetId;

        // 7. Transform page data to row values
        const pageData = entity.propertiesJson as any;
        const rowValues = transformPageToRow(pageData, mappingConfig.columns);

        // Calculate UUID column index (last column if includeNotionId is true)
        const uuidColumnIndex = mappingConfig.includeNotionId
          ? rowValues.length
          : -1;

        // Add Notion page ID if configured (always add it, but hide from user)
        if (mappingConfig.includeNotionId) {
          rowValues.push(notionPageId);
        }

        const newChecksum = computeChecksum(rowValues);

        let rowsCreated = 0;
        let rowsUpdated = 0;

        // 8. Find existing row by UUID in Google Sheets
        let existingRowNumber: number | null = null;

        if (mappingConfig.includeNotionId && uuidColumnIndex >= 0) {
          // Read all rows from the sheet to find the one with matching UUID
          const allRowsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${mappingConfig.sheetName}!${mappingConfig.dataStartRow}:${
              mappingConfig.dataStartRow + 10000
            }`, // Read up to 10k rows
          });

          const allRows = allRowsResponse.data.values || [];
          const uuidColumn = uuidColumnIndex;

          // Find the row with matching UUID
          for (let i = 0; i < allRows.length; i++) {
            const row = allRows[i];
            if (row && row[uuidColumn] === notionPageId) {
              existingRowNumber = mappingConfig.dataStartRow + i;
              break;
            }
          }
        }

        // 9. Update or append row
        if (existingRowNumber !== null) {
          // Row exists, check if it changed
          console.log(
            `Found existing row ${existingRowNumber} for page ${notionPageId}, checking for changes`
          );

          // Read the existing row to compare checksum
          const existingRowResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${mappingConfig.sheetName}!${existingRowNumber}:${existingRowNumber}`,
          });

          const existingRow = existingRowResponse.data.values?.[0] || [];
          const existingChecksum = computeChecksum(existingRow);

          if (existingChecksum !== newChecksum) {
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${mappingConfig.sheetName}!${existingRowNumber}:${existingRowNumber}`,
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [rowValues] },
            });

            rowsUpdated = 1;
            console.log(
              `Updated row ${existingRowNumber} for page ${notionPageId}`
            );
          } else {
            console.log(
              `Row for page ${notionPageId} unchanged, skipping update`
            );
          }
        } else {
          // Row doesn't exist, append as new row
          console.log(
            `No existing row found for page ${notionPageId}, appending as new row`
          );

          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${mappingConfig.sheetName}!A${mappingConfig.dataStartRow}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [rowValues] },
          });

          rowsCreated = 1;
        }

        // 9. Update automation last_synced_at
        await db
          .update(automation)
          .set({ last_synced_at: new Date() })
          .where(eq(automation.id, automationId));

        // 10. Track import progress if automation is importing
        if (automationRecord.import_status === "importing") {
          // Increment import_processed_rows in database after successful write
          // Only increment if this is a new row (not an update)
          if (rowsCreated > 0) {
            // Atomically increment import_processed_rows using raw SQL
            await db.execute(
              sql`UPDATE ${automation} SET import_processed_rows = COALESCE(import_processed_rows, 0) + 1 WHERE id = ${automationId}`
            );

            // Fetch updated values to check completion
            const updatedAutomation = await db.query.automation.findFirst({
              where: eq(automation.id, automationId),
              columns: {
                import_processed_rows: true,
                import_total_rows: true,
              },
            });

            const newProcessedRows =
              updatedAutomation?.import_processed_rows || 0;
            const totalRows = updatedAutomation?.import_total_rows || 0;

            logger.info(
              `Import progress for automation ${automationId}: ${newProcessedRows}/${totalRows} rows written`
            );

            // Check if import is complete
            if (totalRows > 0 && newProcessedRows >= totalRows) {
              await db
                .update(automation)
                .set({
                  import_status: "completed",
                  import_completed_at: new Date(),
                })
                .where(eq(automation.id, automationId));

              logger.info(
                `Import completed for automation ${automationId}. All ${newProcessedRows} rows written.`
              );
            }
          }
        }

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
          where: eq(
            googleSheetsAccount.id,
            automationRecord.googleSheetsAccountId
          ),
        });

        if (!sheetsAccount) {
          throw new Error("Google Sheets account not found");
        }

        // 4. Get the Google Spreadsheet
        if (!automationRecord.googleSpreadSheetId) {
          throw new Error(
            `Automation ${automationId} has no Google Spreadsheet`
          );
        }

        const spreadsheetRecord = await db.query.googleSpreadsheet.findFirst({
          where: eq(googleSpreadsheet.id, automationRecord.googleSpreadSheetId),
        });

        if (!spreadsheetRecord) {
          throw new Error("Google Spreadsheet not found");
        }

        // 5. Initialize Google Sheets API
        // Initialize Google Sheets API with OAuth2Client
        const oauthConfig = getGoogleSheetsOAuthConfig();
        const oauth2Client = new google.auth.OAuth2(
          oauthConfig.clientId,
          oauthConfig.clientSecret
        );

        // Set the credentials with the access token
        oauth2Client.setCredentials({
          access_token: sheetsAccount.access_token,
          refresh_token: sheetsAccount.refresh_token,
        });

        const sheets = google.sheets({
          version: "v4",
          auth: oauth2Client,
        });

        const spreadsheetId = spreadsheetRecord.googleSpreadsheetId;

        // 6. Find existing row by UUID in Google Sheets
        const uuidColumnIndex = mappingConfig.includeNotionId
          ? mappingConfig.columns.length
          : -1;

        let existingRowNumber: number | null = null;

        if (mappingConfig.includeNotionId && uuidColumnIndex >= 0) {
          // Read all rows from the sheet to find the one with matching UUID
          const allRowsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${mappingConfig.sheetName}!${mappingConfig.dataStartRow}:${
              mappingConfig.dataStartRow + 10000
            }`,
          });

          const allRows = allRowsResponse.data.values || [];

          // Find the row with matching UUID
          for (let i = 0; i < allRows.length; i++) {
            const row = allRows[i];
            if (row && row[uuidColumnIndex] === notionPageId) {
              existingRowNumber = mappingConfig.dataStartRow + i;
              break;
            }
          }
        }

        if (existingRowNumber !== null) {
          // Clear the row in Google Sheets (set to empty)
          const range = `${mappingConfig.sheetName}!A${existingRowNumber}:ZZ${existingRowNumber}`;
          await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range,
          });

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
          message: `No row found for page ${notionPageId}`,
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
