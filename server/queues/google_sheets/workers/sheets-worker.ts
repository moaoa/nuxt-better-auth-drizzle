import { Worker } from "bullmq";
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
import { eq, sql } from "drizzle-orm";
import type { MappingConfig } from "~~/types/mapping";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import winston from "winston";
import type { GoogleSheetsJobData, GoogleSheetsJobResult } from "../queue";
import { GOOGLE_SHEETS_QUEUE_NAME } from "../queue";
import {
  createGoogleSheetsClient,
  computeRowChecksum,
  transformPageToRowValues,
} from "~~/server/utils/google-sheets";

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

interface AutomationData {
  automation: typeof automation.$inferSelect;
  mappingConfig: MappingConfig;
  sheetsAccount: typeof googleSheetsAccount.$inferSelect;
  spreadsheet: typeof googleSpreadsheet.$inferSelect;
}

async function loadAutomationData(
  automationId: number
): Promise<AutomationData> {
  const db = useDrizzle();

  const automationRecord = await db.query.automation.findFirst({
    where: eq(automation.id, automationId),
  });

  if (!automationRecord) {
    throw new Error(`Automation ${automationId} not found`);
  }

  const mappingRecord = await db.query.notionSheetsMapping.findFirst({
    where: eq(notionSheetsMapping.automationId, automationId),
  });

  if (!mappingRecord) {
    throw new Error(`Mapping config for automation ${automationId} not found`);
  }

  const mappingConfig = mappingRecord.mappingConfig as MappingConfig;

  if (!automationRecord.googleSheetsAccountId) {
    throw new Error(`Automation ${automationId} has no Google Sheets account`);
  }

  const sheetsAccount = await db.query.googleSheetsAccount.findFirst({
    where: eq(googleSheetsAccount.id, automationRecord.googleSheetsAccountId),
  });

  if (!sheetsAccount) {
    throw new Error("Google Sheets account not found");
  }

  if (!automationRecord.googleSpreadSheetId) {
    throw new Error(`Automation ${automationId} has no Google Spreadsheet`);
  }

  const spreadsheetRecord = await db.query.googleSpreadsheet.findFirst({
    where: eq(googleSpreadsheet.id, automationRecord.googleSpreadSheetId),
  });

  if (!spreadsheetRecord) {
    throw new Error("Google Spreadsheet not found");
  }

  return {
    automation: automationRecord,
    mappingConfig,
    sheetsAccount,
    spreadsheet: spreadsheetRecord,
  };
}

function findRowByUuid(
  rows: (string | number | boolean | null | undefined)[][],
  uuidColumnIndex: number,
  notionPageId: string,
  dataStartRow: number
): number | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[uuidColumnIndex] === notionPageId) {
      return dataStartRow + i;
    }
  }
  return null;
}

async function handleListSpreadsheetsJob(
  userId: string,
  accessToken: string
): Promise<GoogleSheetsJobResult> {
  const db = useDrizzle();
  const drive = google.drive({ version: "v3", auth: accessToken });

  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet'",
    fields: "nextPageToken,files(id,name,exportLinks)",
    access_token: accessToken,
  });

  const apiSpreadsheets = response.data.files || [];
  const nextPageToken = response.data.nextPageToken;

  if (apiSpreadsheets.length === 0 && !nextPageToken) {
    await db
      .delete(googleSpreadsheet)
      .where(eq(googleSpreadsheet.userId, userId));
    return {
      status: "completed",
      message: "No spreadsheets found, all existing records deleted.",
    };
  }

  const spreadsheetUpserts: (typeof googleSpreadsheet.$inferInsert)[] = [];

  for (const apiSheet of apiSpreadsheets) {
    const url =
      apiSheet["exportLinks"]?.[
        "application/x-vnd.oasis.opendocument.spreadsheet"
      ];
    if (!apiSheet.id || !apiSheet.name || !url) continue;

    spreadsheetUpserts.push({
      url,
      userId: userId,
      title: apiSheet.name,
      googleSpreadsheetId: apiSheet.id,
      updatedAt: new Date(),
      createdAt: new Date(),
    });
  }

  await db
    .insert(googleSpreadsheet)
    .values(spreadsheetUpserts)
    .onConflictDoUpdate({
      target: [googleSpreadsheet.googleSpreadsheetId, googleSpreadsheet.userId],
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
}

async function handleWriteHeadersJob(
  automationId: number,
  headers: string[]
): Promise<GoogleSheetsJobResult> {
  const data = await loadAutomationData(automationId);
  const { mappingConfig, sheetsAccount, spreadsheet } = data;

  if (!sheetsAccount.refresh_token) {
    throw new Error(
      `Google Sheets account ${sheetsAccount.id} has no refresh token`
    );
  }

  const sheets = createGoogleSheetsClient(
    sheetsAccount.access_token,
    sheetsAccount.refresh_token
  );

  const spreadsheetId = spreadsheet.googleSpreadsheetId;
  const sheetName = mappingConfig.sheetName || "Sheet1";
  const headerRow = mappingConfig.headerRow || 1;

  const headerValues: string[] = [...headers];

  if (mappingConfig.includeNotionId) {
    headerValues.push("Notion UUID");
  }

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
}

async function updateImportProgress(
  automationId: number,
  rowsProcessed: number
): Promise<void> {
  if (rowsProcessed === 0) return;

  const db = useDrizzle();

  await db.execute(
    sql`UPDATE automation SET import_processed_rows = COALESCE(import_processed_rows, 0) + ${rowsProcessed} WHERE id = ${automationId}`
  );

  const updatedAutomation = await db.query.automation.findFirst({
    where: eq(automation.id, automationId),
    columns: {
      import_processed_rows: true,
      import_total_rows: true,
    },
  });

  const newProcessedRows = updatedAutomation?.import_processed_rows || 0;
  const totalRows = updatedAutomation?.import_total_rows || 0;

  logger.info(
    `Import progress for automation ${automationId}: ${newProcessedRows}/${totalRows} rows processed`
  );

  if (totalRows > 0 && newProcessedRows >= totalRows) {
    await db
      .update(automation)
      .set({
        import_status: "completed",
        import_completed_at: new Date(),
      })
      .where(eq(automation.id, automationId));

    logger.info(
      `Import completed for automation ${automationId}. All ${newProcessedRows} rows processed.`
    );
  }
}

async function handleWriteRowJob(
  automationId: number,
  notionPageId: string
): Promise<GoogleSheetsJobResult> {
  const db = useDrizzle();
  const data = await loadAutomationData(automationId);
  const {
    automation: automationRecord,
    mappingConfig,
    sheetsAccount,
    spreadsheet,
  } = data;

  const entity = await db.query.notionEntity.findFirst({
    where: eq(notionEntity.notionId, notionPageId),
  });

  if (!entity) {
    throw new Error(`Notion entity ${notionPageId} not found in database`);
  }

  const pageData = entity.propertiesJson as PageObjectResponse;

  if (!sheetsAccount.refresh_token) {
    throw new Error(
      `Google Sheets account ${sheetsAccount.id} has no refresh token`
    );
  }

  const sheets = createGoogleSheetsClient(
    sheetsAccount.access_token,
    sheetsAccount.refresh_token
  );

  const spreadsheetId = spreadsheet.googleSpreadsheetId;
  const rowValues = transformPageToRowValues(pageData, mappingConfig.columns);

  if (mappingConfig.includeNotionId) {
    rowValues.push(notionPageId);
  }

  const newChecksum = computeRowChecksum(rowValues);
  let rowsCreated = 0;
  let rowsUpdated = 0;

  let existingRowNumber: number | null = null;

  // Find existing row by Notion UUID if includeNotionId is enabled
  if (mappingConfig.includeNotionId) {
    const uuidColumnIndex = rowValues.length - 1;
    
    logger.info(
      `Looking for existing row with Notion UUID ${notionPageId} in column index ${uuidColumnIndex} for automation ${automationId}`
    );

    const allRowsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${mappingConfig.sheetName}!${mappingConfig.dataStartRow}:${
        mappingConfig.dataStartRow + 10000
      }`,
    });

    const allRows = allRowsResponse.data.values || [];
    existingRowNumber = findRowByUuid(
      allRows,
      uuidColumnIndex,
      notionPageId,
      mappingConfig.dataStartRow
    );

    if (existingRowNumber !== null) {
      logger.info(
        `Found existing row at row ${existingRowNumber} for Notion page ${notionPageId} in automation ${automationId}`
      );
    } else {
      logger.info(
        `No existing row found for Notion page ${notionPageId} in automation ${automationId}, will create new row`
      );
    }
  } else {
    logger.warn(
      `includeNotionId is false for automation ${automationId}, cannot detect existing rows. Will append new row.`
    );
  }

  if (existingRowNumber !== null) {
    // Row exists, check if it needs updating
    const existingRowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${mappingConfig.sheetName}!${existingRowNumber}:${existingRowNumber}`,
    });

    const existingRow = existingRowResponse.data.values?.[0] || [];
    const existingChecksum = computeRowChecksum(existingRow);

    if (existingChecksum !== newChecksum) {
      // Row has changed, update it
      logger.info(
        `Updating row ${existingRowNumber} for Notion page ${notionPageId} in automation ${automationId}`
      );

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${mappingConfig.sheetName}!${existingRowNumber}:${existingRowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [rowValues] },
      });

      rowsUpdated = 1;
      logger.info(
        `Successfully updated row ${existingRowNumber} for Notion page ${notionPageId} in automation ${automationId}`
      );
    } else {
      logger.info(
        `Row ${existingRowNumber} for Notion page ${notionPageId} in automation ${automationId} has no changes, skipping update`
      );
    }
  } else {
    // Row doesn't exist, create new one
    logger.info(
      `Creating new row for Notion page ${notionPageId} in automation ${automationId}`
    );

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${mappingConfig.sheetName}!A${mappingConfig.dataStartRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });

    rowsCreated = 1;
    logger.info(
      `Successfully created new row for Notion page ${notionPageId} in automation ${automationId}`
    );
  }

  await db
    .update(automation)
    .set({ last_synced_at: new Date() })
    .where(eq(automation.id, automationId));

  if (automationRecord.import_status === "importing") {
    // Track all processed rows (both created and updated)
    await updateImportProgress(automationId, rowsCreated + rowsUpdated);
  }

  return {
    status: "completed",
    message: `Synced page ${notionPageId} to Google Sheets`,
    rowsProcessed: 1,
    rowsCreated,
    rowsUpdated,
    rowsDeleted: 0,
  };
}

async function handleDeleteRowJob(
  automationId: number,
  notionPageId: string
): Promise<GoogleSheetsJobResult> {
  const data = await loadAutomationData(automationId);
  const { mappingConfig, sheetsAccount, spreadsheet } = data;

  if (!sheetsAccount.refresh_token) {
    throw new Error(
      `Google Sheets account ${sheetsAccount.id} has no refresh token`
    );
  }

  const sheets = createGoogleSheetsClient(
    sheetsAccount.access_token,
    sheetsAccount.refresh_token
  );

  const spreadsheetId = spreadsheet.googleSpreadsheetId;

  if (!mappingConfig.includeNotionId) {
    return {
      status: "completed",
      message: `No row found for page ${notionPageId}`,
      rowsProcessed: 0,
      rowsCreated: 0,
      rowsUpdated: 0,
      rowsDeleted: 0,
    };
  }

  const uuidColumnIndex = mappingConfig.columns.length;
  const allRowsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${mappingConfig.sheetName}!${mappingConfig.dataStartRow}:${
      mappingConfig.dataStartRow + 10000
    }`,
  });

  const allRows = allRowsResponse.data.values || [];
  const existingRowNumber = findRowByUuid(
    allRows,
    uuidColumnIndex,
    notionPageId,
    mappingConfig.dataStartRow
  );

  if (existingRowNumber === null) {
    return {
      status: "completed",
      message: `No row found for page ${notionPageId}`,
      rowsProcessed: 0,
      rowsCreated: 0,
      rowsUpdated: 0,
      rowsDeleted: 0,
    };
  }

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

export const googleSheetsWorker = new Worker<
  GoogleSheetsJobData,
  GoogleSheetsJobResult
>(
  GOOGLE_SHEETS_QUEUE_NAME,
  async (job) => {
    const { jobType } = job.data;

    try {
      if (jobType === "list-spreadsheets") {
        const data = job.data as Extract<
          GoogleSheetsJobData,
          { jobType: "list-spreadsheets" }
        >;
        return await handleListSpreadsheetsJob(data.userId, data.accessToken);
      }

      if (jobType === "write-headers") {
        const data = job.data as Extract<
          GoogleSheetsJobData,
          { jobType: "write-headers" }
        >;
        return await handleWriteHeadersJob(data.automationId, data.headers);
      }

      if (jobType === "write-row") {
        const data = job.data as Extract<
          GoogleSheetsJobData,
          { jobType: "write-row" }
        >;
        return await handleWriteRowJob(data.automationId, data.notionPageId);
      }

      if (jobType === "delete-row") {
        const data = job.data as Extract<
          GoogleSheetsJobData,
          { jobType: "delete-row" }
        >;
        return await handleDeleteRowJob(data.automationId, data.notionPageId);
      }

      throw new Error(`Unknown job type: ${jobType}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(
        `Google Sheets ${jobType} job ${job.id} failed: ${errorMessage}`,
        {
          error: errorStack,
          jobId: job.id,
          jobData: job.data,
        }
      );
      throw new Error(`Google Sheets ${jobType} failed: ${errorMessage}`);
    }
  },
  {
    connection,
    telemetry: new BullMQOtel("google-sheets-worker"),
    limiter: {
      max: 300,
      duration: 60000,
    },
  }
);
