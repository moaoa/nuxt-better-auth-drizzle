import { defineEventHandler } from "h3";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { automation } from "~~/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  const db = useDrizzle();

  const userAutomations = await db.query.automation.findMany({
    where: eq(automation.user_id, user.id),
    columns: {
      id: false,
    },
  });

  return {
    data: userAutomations,
  };
});
