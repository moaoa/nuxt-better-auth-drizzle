import { Client } from "@notionhq/client";
import { auth } from "~~/lib/auth";
import { workspace } from "~~/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const db = useDrizzle();

  const workspaceUUID = event.context.params?.uuid;

  const workspaceItem = await db.query.workspace.findFirst({
    where: eq(workspace.uuid, workspaceUUID ?? ""),
  });

  if (!workspaceItem) {
    throw createError({
      statusCode: 404,
      message: "Workspace not found.",
    });
  }

  const account = await db.query.workspace.findFirst({
    where: eq(workspace.uuid, workspaceUUID ?? ""),
    with: {
      serviceAccount: {
        columns: {
          access_token: true,
        },
      },
    },
  });

  if (!account) {
    throw createError({
      statusCode: 404,
      message: "Service account not found.",
    });
  }

  const notion = new Client({ auth: account.serviceAccount.access_token });

  try {
    const response = await notion.search({
      filter: {
        property: "object",
        value: "database",
      },
    });

    const databases = response.results.filter((db) => {
      if ("parent" in db && db.parent.type === "page_id") {
        return db.parent.page_id === workspaceItem.notion_workspace_id;
      }
      return false;
    });

    // TODO: filter dbs based on their structure if they support the quickbooks service or not
    // TODO: Save the dbs in the db before returning them

    return databases;
  } catch (error) {
    console.error("Error fetching Notion databases:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch Notion databases.",
    });
  }
});
