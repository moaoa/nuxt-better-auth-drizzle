import { auth } from "~~/lib/auth";
import { useDrizzle } from "~~/server/utils/drizzle";
import { automation } from "~~/db/schema";
import { eq, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  const automationUuid = getRouterParam(event, "uuid");

  if (!automationUuid) {
    throw createError({
      statusCode: 400,
      message: "Automation UUID is required",
    });
  }

  const db = useDrizzle();

  // Find automation and verify ownership
  const automationRecord = await db.query.automation.findFirst({
    where: and(
      eq(automation.uuid, automationUuid),
      eq(automation.user_id, session!.user.id)
    ),
  });

  if (!automationRecord) {
    throw createError({
      statusCode: 404,
      message: "Automation not found",
    });
  }

  // Delete automation (cascade will handle related records)
  await db.delete(automation).where(eq(automation.uuid, automationUuid));

  return {
    success: true,
    message: "Automation deleted successfully",
  };
});

