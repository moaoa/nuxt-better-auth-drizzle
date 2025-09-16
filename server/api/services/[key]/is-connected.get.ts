import { defineEventHandler, getRouterParam } from "h3";
import { eq } from "drizzle-orm";
import { notionAccount } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { auth } from "~~/lib/auth";
import { serviceKeys, type ServiceKey } from "~~/types/services";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers,
  });

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const serviceKey = getRouterParam(event, "key") as ServiceKey;

  if (!serviceKey) {
    throw createError({
      statusCode: 400,
      message: "Service key is required",
    });
  }

  if (!serviceKeys.includes(serviceKey)) {
    throw createError({
      statusCode: 400,
      message: "Invalid service key",
    });
  }

  const db = useDrizzle();

  switch (serviceKey) {
    case "notion":
      const existingNotionAccount = await db.query.notionAccount.findFirst({
        where: eq(notionAccount.user_id, session.user.id),
      });

      return {
        connected: !!existingNotionAccount,
      };
    case "google_sheet":
      return {
        connected: false,
      };
    case "quickbooks":
      return {
        connected: false,
      };
    default:
      const _: never = serviceKey;
      return {
        connected: false,
      };
  }
});
