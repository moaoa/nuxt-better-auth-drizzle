import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { notionEntity, notionAccount } from "~~/db/schema";
import { and, eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const databaseUuid = getRouterParam(event, "uuid");

  if (!databaseUuid) {
    throw createError({
      statusCode: 400,
      message: "Database UUID is required",
    });
  }

  const db = useDrizzle();

  // Find the database entity and verify user access
  const databaseEntity = await db.query.notionEntity.findFirst({
    where: and(
      eq(notionEntity.notionId, databaseUuid),
      eq(notionEntity.type, "database")
    ),
  });

  if (!databaseEntity) {
    throw createError({
      statusCode: 404,
      message: "Database not found",
    });
  }

  // Verify user has access through the account
  const account = await db.query.notionAccount.findFirst({
    where: and(
      eq(notionAccount.id, databaseEntity.accountId),
      eq(notionAccount.user_id, user.id)
    ),
  });

  if (!account) {
    throw createError({
      statusCode: 403,
      message: "Access denied",
    });
  }

  // Extract properties from the database schema
  // The propertiesJson contains the full database object with properties
  const propertiesJson = databaseEntity.propertiesJson as any;
  const properties = propertiesJson?.properties || {};

  // Convert properties object to array format
  const propertiesArray = Object.entries(properties).map(
    ([propId, propData]: [string, any]) => ({
      id: propId,
      name: propData.name || propId,
      type: propData.type || "unknown",
    })
  );

  return propertiesArray;
});

