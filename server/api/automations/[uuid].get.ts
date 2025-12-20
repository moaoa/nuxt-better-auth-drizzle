import { auth } from "~~/lib/auth";
import { automation } from "~~/db/schema";
import { and, eq } from "drizzle-orm";
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
      uuid: true,
      name: true,
      is_active: true,
      import_status: true,
      import_started_at: true,
      import_completed_at: true,
      import_total_rows: true,
      import_processed_rows: true,
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

  return automationRecord;
});
