import { desc } from "drizzle-orm";
import { notionOAuthRecord } from "~~/db/schema";
import { NotionOAuthResponse } from "~~/types/notion";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const code = body.code as string;

  const config = useRuntimeConfig();

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "No code provided",
    });
  }

  try {
    const encodedToken = Buffer.from(
      `${config.public.NOTION_OAUTH_CLIENT_ID}:${config.NOTION_OAUTH_CLIENT_SECRET}`
    ).toString("base64");

    const body = JSON.stringify({
      redirect_uri: config.public.NOTION_OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
      code,
    });

    const response = await $fetch<NotionOAuthResponse>(
      config.public.NOTION_TOKEN_URL,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${encodedToken}`,
        },
        body,
      }
    );

    const db = useDrizzle();

    const lastRecord = await db
      .select()
      .from(notionOAuthRecord)
      .orderBy(desc(notionOAuthRecord.id))
      .limit(1);

    const lastId = lastRecord?.at(0)?.id ?? 0;

    await db.insert(notionOAuthRecord).values({
      id: lastId + 1,
      ...response,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(response);

    // fill the many to many table (between records and users)

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "no message";
    console.error("Error exchanging code for token:", msg);

    throw createError({
      statusCode: 500,
      message: "Failed to exchange code for token: " + msg,
      cause: error,
    });
  }
});
