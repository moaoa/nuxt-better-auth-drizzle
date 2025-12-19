import { defineEventHandler } from "h3";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { automation, notionSheetsRowMapping } from "~~/db/schema";
import { eq, desc, count } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  const db = useDrizzle();

  const userAutomations = await db.query.automation.findMany({
    where: eq(automation.user_id, user.id),
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
    orderBy: [desc(automation.createdAt)],
  });

  // Calculate import_processed_rows by counting row mappings for each automation
  const automationsWithProgress = await Promise.all(
    userAutomations.map(async (automationRecord) => {
      // Only count if import is in progress
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
    })
  );

  return automationsWithProgress;
});
