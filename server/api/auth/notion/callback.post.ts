import { desc } from "drizzle-orm";
import { notionOAuth, notionOAuthUsers, workspace } from "~~/db/schema";
import { NotionOAuthResponse } from "~~/types/notion";
import { auth } from "~~/lib/auth";
import { getNextId } from "~~/lib/utils";

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

    const nextOauthId = await getNextId(db, notionOAuth, notionOAuth.id);
    const nextWorkspaceId = await getNextId(db, workspace, workspace.id);

    const session = await auth.api.getSession({
      headers: event.headers,
    });

    if (!session) throw new Error("Session not found");

    await db.transaction(async (tx) => {
      await tx.insert(notionOAuth).values({
        id: nextOauthId,
        uuid: response.workspace_id,
        access_token: response.access_token,
        notion_workspace_id: response.workspace_id,
        token_type: response.token_type,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(notionOAuthUsers).values({
        notion_oauth_id: nextOauthId,
        user_id: session.user.id,
      });

      await tx.insert(workspace).values({
        id: nextWorkspaceId,
        uuid: response.workspace_id,
        workspace_name: response.workspace_name,
        workspace_icon: response.workspace_icon,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

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
