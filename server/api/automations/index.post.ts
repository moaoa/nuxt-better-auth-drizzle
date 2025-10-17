import { z } from "zod";
import { auth } from "~~/lib/auth";
import {
  automation,
  automationType,
  googleSheetsAccount,
  notionAccount,
  user,
} from "~~/db/schema";
import { and, eq } from "drizzle-orm";
import { AutomationType } from "~~/types/automations";

const CreateNotionDbToGoogleSheetAutomationSchema = z.object({
  type: z.literal(AutomationType.NotionDbToGoogleSheet),
  googleSheetId: z.string(),
  notionEntityId: z.string(),
  googleSheetsAccountId: z.string(),
  notionAccountId: z.string(),
  config: z.object({
    createNewGoogleSheet: z.boolean(),
    createNewNotionDb: z.boolean(),
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
    config,
  } = validation.data;

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

  try {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return newAutomation;
  } catch (error) {
    console.error("Error creating automation record:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create automation record.",
    });
  }
});
