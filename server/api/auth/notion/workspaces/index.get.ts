import { workspace } from "~~/db/schema";
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

  const workspaces = await db.select().from(workspace);

  return workspaces;
});
