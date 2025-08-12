import { eq } from "drizzle-orm";
import { workspace, workspaceUsers } from "~~/db/schema";
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

  const workspaces = await db
    .select()
    .from(workspace)
    .innerJoin(workspaceUsers, eq(workspaceUsers.workspace_id, workspace.id))
    .where(eq(workspaceUsers.user_id, session.user.id));

  return { workspaces };
});
