import { desc, eq } from "drizzle-orm";
import { service, serviceAccount, workspace } from "~~/db/schema";
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

    const db = useDrizzle();

    const notionService = await db.query.service.findFirst({
      where: eq(service.service_key, "notion"),
      columns: {
        id: true,
      },
    });

    if (!notionService) {
      throw createError({
        statusCode: 404,
        message: "Service not found.",
      });
    }

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

    const nextOauthId = await getNextId(db, serviceAccount, serviceAccount.id);
    const nextWorkspaceId = await getNextId(db, workspace, workspace.id);

    const session = await auth.api.getSession({
      headers: event.headers,
    });

    if (!session) throw new Error("Session not found");

    const item = await db.query.workspace.findFirst({
      where: eq(workspace.uuid, response.workspace_id),
    });

    if (item) {
      return;
    }

    await db.transaction(async (tx) => {
      await tx.insert(workspace).values({
        id: nextWorkspaceId,
        uuid: response.workspace_id,
        workspace_name: response.workspace_name,
        workspace_icon: response.workspace_icon,
        notion_workspace_id: response.workspace_id,
        service_account_id: nextOauthId,
        bot_id: response.bot_id,
        duplicated_template_id: response.duplicated_template_id,
        owner: response.owner,
        request_id: response.request_id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(serviceAccount).values({
        id: nextOauthId,
        uuid: response.workspace_id,
        access_token: response.access_token,
        token_type: response.token_type,
        service_id: notionService.id,
        user_id: session.user.id,
        user_name: response.owner.user.name,
        revoked_at: null,
        refresh_token: null,
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
