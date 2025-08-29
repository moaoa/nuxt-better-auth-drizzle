import { Client } from "@notionhq/client";
import { auth } from "~~/lib/auth";
import { serviceAccount, workspace } from "~~/db/schema";
import { and, eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const db = useDrizzle();

  const workspaceUUID = event.context.params?.uuid;

  const exist = await db.query.workspace.findFirst({
    where: eq(workspace.uuid, workspaceUUID ?? ""),
  });

  if (!exist) {
    throw createError({
      statusCode: 404,
      message: "Workspace not found.",
    });
  }

  // const account = await db.query.workspace.findFirst({
  //   // where: and(
  //   //   eq(workspace.uuid, workspaceUUID ?? ""),
  //   //   eq(serviceAccount.user_id, session.user.id)
  //   // ),
  //   where: eq(workspace.uuid, workspaceUUID ?? ""),
  //   with: {
  //     serviceAccount: {
  //       columns: {
  //         access_token: true,
  //       },
  //       where: eq(serviceAccount.user_id, session.user.id),
  //     },
  //   },
  // });

  const account = await db
    .select({
      access_token: serviceAccount.access_token,
    })
    .from(workspace)
    .innerJoin(
      serviceAccount,
      eq(workspace.service_account_id, serviceAccount.id)
    )
    .where(
      and(
        eq(workspace.uuid, workspaceUUID!),
        eq(serviceAccount.user_id, session.user.id)
      )
    )
    .limit(1)
    .then((rows) => rows.at(0));

  if (!account) {
    throw createError({
      statusCode: 404,
      message: "Service account not found.",
    });
  }

  const notion = new Client({ auth: account.access_token });

  try {
    const response = await notion.search({
      filter: {
        property: "object",
        value: "database",
      },
    });
    return response.results;
  } catch (error) {
    console.error("Error fetching Notion databases:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch Notion databases.",
    });
  }
});
