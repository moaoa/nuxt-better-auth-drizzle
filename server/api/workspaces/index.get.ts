import { eq } from "drizzle-orm";
import { notionAccount, workspace } from "~~/db/schema";
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

  // TODO: Save the workspaces before returning them (if they don't exist)
  // const result = await db
  //   .select({
  //     uuid: workspace.uuid,
  //     name: workspace.workspace_name,
  //     icon: workspace.workspace_icon,
  //   })
  //   .from(workspace)
  //   .innerJoin(notionAccount, eq(workspace.notion_account_id, notionAccount.id))
  //   .where(eq(notionAccount.user_id, session.user.id));

  // const result = await db.query.workspace.findMany({
  //   where: eq(workspace.user_id, session.user.id),
  // });

  return { workspaces: [] };
});
