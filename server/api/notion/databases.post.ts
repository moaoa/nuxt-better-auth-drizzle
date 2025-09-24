import { eq } from "drizzle-orm";
import { notionAccount } from "~~/db/schema";
import { Client } from "@notionhq/client";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  const { name, parentId } = await readBody(event);

  if (!name || !parentId) {
    throw createError({
      statusCode: 400,
      message: "Missing name or parentId",
    });
  }

  const db = useDrizzle();

  const result = await db.query.notionAccount.findFirst({
    where: eq(notionAccount.user_id, user.id),
    columns: {
      access_token: true,
    },
  });

  if (!result?.access_token) {
    throw createError({
      statusCode: 401,
      message: "Notion access token not found",
    });
  }

  const notion = new Client({
    auth: result.access_token,
  });

  const dbResponse = await notion.databases.create({
    parent: {
      type: "page_id",
      page_id: parentId,
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
    },
  });

  return dbResponse;
});
