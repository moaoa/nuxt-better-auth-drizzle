import { defineEventHandler } from "h3";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { automation } from "~~/db/schema";
import { eq, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  const db = useDrizzle();

  const userAutomations = await db.query.automation.findMany({
    where: eq(automation.user_id, user.id),
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
    orderBy: [desc(automation.createdAt)],
  });

  return userAutomations;
});
