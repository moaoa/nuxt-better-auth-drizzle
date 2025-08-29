import { Client } from "@notionhq/client";
import { auth } from "~~/lib/auth";
import { serviceAccount, workspace } from "~~/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const body = await readBody(event);
  const { name, service_uuid } = body;
  //TODO: based on teh service create the appropriate db props

  if (!name) {
    throw createError({
      statusCode: 400,
      message: "Database name is required.",
    });
  }

  const workspaceUUID = event.context.params?.uuid;

  const db = useDrizzle();

  const _workspace = await db.query.workspace.findFirst({
    where: eq(workspace.uuid, workspaceUUID ?? ""),
  });

  if (!workspaceUUID || !_workspace) {
    throw createError({
      statusCode: 404,
      message: "Workspace not found.",
    });
  }

  const userServiceAccount = await db.query.serviceAccount.findFirst({
    where: eq(serviceAccount.user_id, session.user.id),
  });

  if (!userServiceAccount) {
    throw createError({
      statusCode: 404,
      message: "User not associated with any account.",
    });
  }

  const notion = new Client({ auth: userServiceAccount.access_token });

  try {
    const response = await notion.databases.create({
      parent: {
        type: "page_id",
        page_id: _workspace.notion_workspace_id,
      },
      title: [
        {
          type: "text",
          text: {
            content: name,
          },
        },
      ],
      properties: {
        Name: {
          title: {},
        },
        //TODO: put the props based on the service
      },
    });
    return response;
  } catch (error) {
    console.error("Error creating Notion database:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create Notion database.",
    });
  }
});
