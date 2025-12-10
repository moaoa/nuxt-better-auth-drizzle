import { eq } from "drizzle-orm";
import { automationType, notionAccount, workspace } from "~~/db/schema";
import { NotionOAuthResponse } from "~~/types/notion";
import { auth } from "~~/lib/auth";
import { addNotionSyncJob } from "~~/server/queues/notion-sync";
import { notionLogger } from "~~/lib/loggers";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const code = body.code as string;
  const redirect_uri = body.redirect_uri as string;

  const config = useRuntimeConfig();

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "No code provided",
    });
  }

  if (!redirect_uri) {
    throw createError({
      statusCode: 400,
      message: "No redirect_uri provided",
    });
  }

  try {
    const encodedToken = Buffer.from(
      `${config.public.NOTION_OAUTH_CLIENT_ID}:${config.NOTION_OAUTH_CLIENT_SECRET}`
    ).toString("base64");

    const db = useDrizzle();

    const notionAutomationType = await db.query.automationType.findFirst({
      where: eq(automationType.automationTypeKey, "notion"),
      columns: {
        id: true,
      },
    });

    if (!notionAutomationType) {
      throw createError({
        statusCode: 404,
        message: "Notion automation type not found.",
      });
    }

    // Notion OAuth token endpoint requires form-encoded data, not JSON
    const formData = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri,
      code,
    });

    let response: NotionOAuthResponse;
    try {
      response = await $fetch<NotionOAuthResponse>(
        // @ts-expect-error TODO: fix types
        config.public.NOTION_TOKEN_URL,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${encodedToken}`,
          },
          body: formData.toString(),
        }
      );
    } catch (fetchError: any) {
      // Extract detailed error information from Notion's response
      const errorData = fetchError?.data || fetchError?.response?._data;
      const errorMessage =
        errorData?.error || fetchError?.message || "Unknown error";
      const errorDescription =
        errorData?.error_description || errorData?.error_description || "";

      console.error("Notion OAuth Error Details:", {
        status: fetchError?.status || fetchError?.statusCode || 400,
        error: errorMessage,
        description: errorDescription,
        fullResponse: errorData,
        redirect_uri_used: redirect_uri,
        redirect_uri_expected: config.public.NOTION_OAUTH_REDIRECT_URI,
      });

      notionLogger.error({
        error: errorMessage,
        description: errorDescription,
        status: fetchError?.status || fetchError?.statusCode,
        redirect_uri,
      });

      throw createError({
        statusCode: fetchError?.status || fetchError?.statusCode || 400,
        message: `Notion OAuth error: ${errorMessage}${
          errorDescription ? ` - ${errorDescription}` : ""
        }`,
        data: {
          error: errorMessage,
          error_description: errorDescription,
          redirect_uri_mismatch:
            redirect_uri !== config.public.NOTION_OAUTH_REDIRECT_URI,
        },
      });
    }

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

      return { notionAccountId };
    });

    await addNotionSyncJob({
      userId: session.user.id,
      notionAccountId: notionAccountId,
    });

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "no message";
    console.error("Error exchanging code for token:", msg);

    notionLogger.error({ error, requestBody: body });

    throw createError({
      statusCode: 500,
      message: "Failed to exchange code for token: " + msg,
      cause: error,
    });
  }
});
