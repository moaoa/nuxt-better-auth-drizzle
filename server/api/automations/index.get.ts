import { eq } from "drizzle-orm";
import { automation, automationUsers } from "~~/db/schema";
import { auth } from "~~/lib/auth";
import { useDrizzle } from "~~/server/utils/drizzle";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers,
  });

  if (!session) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const db = useDrizzle();

  const automations = await db
    .select()
    .from(automation)
    .innerJoin(
      automationUsers,
      eq(automationUsers.automation_id, automation.id)
    )
    .where(eq(automationUsers.user_id, session.user.id));

  return { automations };
});
