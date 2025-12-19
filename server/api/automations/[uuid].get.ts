import { auth } from "~~/lib/auth";
import { automation, notionSheetsRowMapping } from "~~/db/schema";
import { and, eq, count } from "drizzle-orm";
import { useDrizzle } from "~~/server/utils/drizzle";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  const automationUuid = getRouterParam(event, "uuid");

  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  if (!automationUuid) {
    throw createError({
      statusCode: 400,
      message: "Automation UUID is required",
    });
  }

  const db = useDrizzle();

  const automationRecord = await db.query.automation.findFirst({
    where: and(
      eq(automation.uuid, automationUuid),
      eq(automation.user_id, session.user.id)
    ),
    columns: {
      id: true,
      uuid: true,
      name: true,
      is_active: true,
      import_status: true,
      import_started_at: true,
      import_completed_at: true,
      import_total_rows: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!automationRecord) {
    throw createError({
      statusCode: 404,
      message: "Automation not found",
    });
  }

  // Calculate import_processed_rows by counting row mappings if import is in progress
  if (automationRecord.import_status === "importing") {
    const rowMappingCountResult = await db
      .select({ count: count() })
      .from(notionSheetsRowMapping)
      .where(eq(notionSheetsRowMapping.automationId, automationRecord.id));

    const import_processed_rows = rowMappingCountResult[0]?.count || 0;

    return {
      ...automationRecord,
      import_processed_rows,
    };
  }

  return automationRecord;
});
