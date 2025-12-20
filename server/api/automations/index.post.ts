import { z } from "zod";
import { auth } from "~~/lib/auth";
import {
  automation,
  automationType,
  googleSheetsAccount,
  googleSpreadsheet,
  notionAccount,
  notionEntity,
  notionSheetsMapping,
  user,
} from "~~/db/schema";
import { and, eq } from "drizzle-orm";
import { AutomationType } from "~~/types/automations";
import { useDrizzle } from "~~/server/utils/drizzle";
import { addNotionImportJob } from "~~/server/queues/notion-sync";
import type { MappingConfig, ColumnMapping } from "~~/types/mapping";
import type { NotionPropertyType } from "~~/types/mapping";

const CreateNotionDbToGoogleSheetAutomationSchema = z.object({
  type: z.literal(AutomationType.NotionDbToGoogleSheet),
  googleSheetId: z.string().optional(),
  notionEntityId: z.string(),
  googleSheetsAccountId: z.string(),
  notionAccountId: z.string(),
  selectedColumns: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
      })
    )
    .optional()
    .default([]),
  config: z.object({
    createNewGoogleSheet: z.boolean(),
    createNewNotionDb: z.boolean(),
    googleSheetName: z.string().optional(),
  }),
});

const CreateAutomationSchema = z.discriminatedUnion("type", [
  CreateNotionDbToGoogleSheetAutomationSchema,
]);

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });

  const db = useDrizzle();

  const body = await readBody(event);

  const validation = CreateAutomationSchema.safeParse(body);

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: "Invalid request body.",
      data: validation.error.errors,
    });
  }

  const {
    type,
    googleSheetId,
    notionEntityId,
    googleSheetsAccountId,
    notionAccountId,
    selectedColumns = [],
    config,
  } = validation.data;

  // If creating a new Google Sheet, we need to create it first
  // For now, we'll require an existing sheet ID
  if (config.createNewGoogleSheet) {
    throw createError({
      statusCode: 400,
      message:
        "Creating new Google Sheets is not yet supported. Please select an existing sheet.",
    });
  }

  if (!googleSheetId) {
    throw createError({
      statusCode: 400,
      message: "Google Sheet ID is required when not creating a new sheet.",
    });
  }

  const _automationType = await db.query.automationType.findFirst({
    where: eq(automationType.automationTypeKey, type),
  });

  const _googleSheetsAccount = await db.query.googleSheetsAccount.findFirst({
    where: and(
      eq(googleSheetsAccount.googleSheetsId, googleSheetsAccountId),
      eq(googleSheetsAccount.user_id, session!.user.id)
    ),
  });

  const _notionAccount = await db.query.notionAccount.findFirst({
    where: and(
      eq(notionAccount.uuid, notionAccountId),
      eq(notionAccount.user_id, session!.user.id)
    ),
  });

  if (!_automationType) {
    throw createError({
      statusCode: 404,
      message: "Automation type not found.",
    });
  }

  if (!_googleSheetsAccount) {
    throw createError({
      statusCode: 404,
      message: "Google Sheets account not found.",
    });
  }

  if (!_notionAccount) {
    throw createError({
      statusCode: 404,
      message: "Notion account not found.",
    });
  }

  // Find notionEntity by UUID and verify it belongs to the account
  const _notionEntity = await db.query.notionEntity.findFirst({
    where: and(
      eq(notionEntity.notionId, notionEntityId),
      eq(notionEntity.accountId, _notionAccount.id)
    ),
  });

  if (!_notionEntity) {
    throw createError({
      statusCode: 404,
      message: "Notion entity not found.",
    });
  }

  // Verify it's a database type
  if (_notionEntity.type !== "database") {
    throw createError({
      statusCode: 400,
      message: "Selected entity must be a database.",
    });
  }

  // Find googleSpreadsheet by UUID and verify it belongs to the user
  const _googleSpreadsheet = await db.query.googleSpreadsheet.findFirst({
    where: and(
      eq(googleSpreadsheet.googleSpreadsheetId, googleSheetId),
      eq(googleSpreadsheet.userId, session!.user.id)
    ),
  });

  if (!_googleSpreadsheet) {
    throw createError({
      statusCode: 404,
      message: "Google Spreadsheet not found.",
    });
  }

  try {
    // 1. Create automation record
    const newAutomation = await db
      .insert(automation)
      .values({
        uuid: crypto.randomUUID(),
        name: "Notion db to google sheets",
        user_id: session!.user.id,
        automationTypeId: _automationType.id,
        is_active: true,
        interval: "5m",
        googleSheetsAccountId: _googleSheetsAccount.id,
        notionAccountId: _notionAccount.id,
        notionEntityId: _notionEntity.id,
        googleSpreadSheetId: _googleSpreadsheet.id,
        import_status: "importing",
        import_started_at: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 2. Build ColumnMapping array from selected columns
    // Get database properties to build column mappings
    const propertiesJson = _notionEntity.propertiesJson as any;
    const properties = propertiesJson?.properties || {};

    // Helper function to convert column index to letter (A, B, C, etc.)
    const indexToColumnLetter = (index: number): string => {
      let result = "";
      index++;
      while (index > 0) {
        index--;
        result = String.fromCharCode(65 + (index % 26)) + result;
        index = Math.floor(index / 26);
      }
      return result;
    };

    // Build column mappings from selected columns
    const columns: ColumnMapping[] = selectedColumns.map(
      (selectedCol, index) => {
        const propData = properties[selectedCol.id] || {};
        return {
          notionPropertyId: selectedCol.id,
          notionPropertyName: selectedCol.name,
          notionPropertyType: (selectedCol.type ||
            "rich_text") as NotionPropertyType,
          sheetColumnIndex: index,
          sheetColumnLetter: indexToColumnLetter(index),
        };
      }
    );

    // 3. Create notionSheetsMapping record
    const mappingConfig: MappingConfig = {
      automationId: newAutomation[0].id,
      headerRow: 1,
      dataStartRow: 2,
      columns: columns,
      includeNotionId: true, // Always include UUID column (hidden from user)
      includeLastSync: false,
      sheetName: "Sheet1", // Default sheet name
    };

    await db.insert(notionSheetsMapping).values({
      automationId: newAutomation[0].id,
      mappingConfig: mappingConfig,
    });

    // 4. Queue initial import job
    await addNotionImportJob({
      automationId: newAutomation[0].id,
      notionDatabaseId: _notionEntity.notionId,
    });

    // Return only public fields (no internal IDs)
    return newAutomation.map((auto) => ({
      uuid: auto.uuid,
      name: auto.name,
      is_active: auto.is_active,
      import_status: auto.import_status,
      import_started_at: auto.import_started_at,
      import_completed_at: auto.import_completed_at,
      import_total_rows: auto.import_total_rows,
      createdAt: auto.createdAt,
      updatedAt: auto.updatedAt,
    }));
  } catch (error) {
    console.error("Error creating automation record:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create automation record.",
    });
  }
});
