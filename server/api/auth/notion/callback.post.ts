import { eq } from "drizzle-orm";
import { service, notionAccount, workspace } from "~~/db/schema";
import { NotionOAuthResponse } from "~~/types/notion";
import { auth } from "~~/lib/auth";
import { notionSyncQueue } from "~~/server/queues/notion-sync";

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
        message: "Notion Service not found.",
      });
    }

    const response = await $fetch<NotionOAuthResponse>(
      // @ts-expect-error TODO: fix types
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

    const session = await auth.api.getSession({
      headers: event.headers,
    });

    if (!session) throw new Error("Session not found");

    const { notionAccountId } = await db.transaction(async (tx) => {
      await tx
        .insert(workspace)
        .values({
          uuid: response.workspace_id,
          workspace_name: response.workspace_name,
          workspace_icon: response.workspace_icon,
          notion_workspace_id: response.workspace_id,
          bot_id: response.bot_id,
          duplicated_template_id: response.duplicated_template_id,
          owner: response.owner,
          request_id: response.request_id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: workspace.notion_workspace_id });

      const { id } = (await tx.query.workspace.findFirst({
        where: eq(workspace.notion_workspace_id, response.workspace_id),
        columns: {
          id: true,
        },
      })) ?? { id: 0 };

      const [{ notionAccountId }] = await tx
        .insert(notionAccount)
        .values({
          uuid: crypto.randomUUID(),
          access_token: response.access_token,
          token_type: response.token_type,
          user_id: session.user.id,
          user_name: `${response.owner.user.name}`,
          revoked_at: null,
          refresh_token: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          workspace_id: id,
        })
        .onConflictDoUpdate({
          target: [notionAccount.workspace_id, notionAccount.user_id],
          set: {
            access_token: response.access_token,
            token_type: response.token_type,
            revoked_at: null,
            refresh_token: null,
            updatedAt: new Date(),
          },
        })
        .returning({ notionAccountId: notionAccount.id });

      console.log(
        "=============================================================================================================================="
      );
      console.log(
        "Notion account created:",
        notionAccountId,
        response.access_token
      );

      return { notionAccountId };
    });

    await notionSyncQueue.add("notion-sync-job", {
      userId: session.user.id,
      notionAccountId: notionAccountId,
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
