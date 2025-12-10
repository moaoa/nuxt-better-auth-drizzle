import { z } from "zod";
import { googleSheetsQueue } from "~~/server/queues/googleSheetsQueue";
import { notionSyncQueue } from "~~/server/queues/notion-sync";
import { requireUserSession } from "~~/server/utils/session";

const existingDbSchema = z.object({
  sheetId: z.string(),
  dbId: z.string(),
});

const newDbSchema = z.object({
  sheetId: z.string(),
  dbName: z.string(),
  parentPageId: z.string(),
});

const requestSchema = z.union([existingDbSchema, newDbSchema]);

export default defineEventHandler(async (event) => {
  const result = await readValidatedBody(event, (body) =>
    requestSchema.safeParse(body)
  );

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request body",
      data: result.error.issues,
    });
  }

  const body = result.data;
  const { user } = await requireUserSession(event);
  const userId = user.id;

  if ("dbId" in body) {
    await googleSheetsQueue.add("fetch-100-rows-for-notion-import", {
      userId,
      sheetId: body.sheetId,
      notionDbId: body.dbId,
    });
  } else {
    await notionSyncQueue.add("create-db-for-gsheets-import", {
      userId,
      sheetId: body.sheetId,
      dbName: body.dbName,
      parentPageId: body.parentPageId,
    });
  }

  setResponseStatus(event, 202);
  return {
    message:
      "Request accepted. The Google Sheet to Notion sync is being processed.",
  };
});
