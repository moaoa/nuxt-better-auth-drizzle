import { desc } from "drizzle-orm";
import { notionOAuthRecord, notionOAuthRecordsUsers } from "~~/db/schema";
import { NotionOAuthResponse } from "~~/types/notion";
import { auth } from "~~/lib/auth";

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

    const oAuthRecordId = (lastRecord?.at(0)?.id ?? 0) + 1;

    const session = await auth.api.getSession({
      headers: event.headers,
    });

    if (!session) throw new Error("Session not found");

    await db.transaction(async (tx) => {
      await tx.insert(notionOAuthRecord).values({
        id: oAuthRecordId,
        ...response,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(notionOAuthRecordsUsers).values({
        notion_oauth_record_id: oAuthRecordId,
        user_id: session.user.id,
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
/*
insert into "verification" ("id", "identifier", "value", "expires_at", "created_at", "updated_at") values ($1, $2, $3, $4, $5, $6) returning "id", "identifier", "value", "expires_at", "created_at", "updated_at" -- params: ["O3V0Xk2K6oJQAEMYvbD39Ec7cjirh6Gi", "cHN3hF3mXiZyumHlCcONXKe9GOVCFmAs", "{\"callbackURL\":\"/app/\",\"codeVerifier\":\"H6sF9sTGjYRlhGZ4j5eCmdGy8rhR0zS9FbLROLNmNCFpIWt_SatzjIZu4gGbZvX9CrcnJ7oGMx-AtNE8na0j_ouL0Kb4hQE7SdtqksbVVzjbX-wj1mNSnnXMnPW-m9Ht\",\"expiresAt\":1753465910406}", "2025-07-25T17:51:50.406Z", "2025-07-25T17:41:50.406Z", "2025-07-25T17:41:50.406Z"]
Query: select "id", "identifier", "value", "expires_at", "created_at", "updated_at" from "verification" where "verification"."identifier" = $1 order by "verification"."created_at" desc limit $2 -- params: ["cHN3hF3mXiZyumHlCcONXKe9GOVCFmAs", 1]
Query: delete from "verification" where "verification"."expires_at" < $1 -- params: ["2025-07-25T17:41:51.025Z"]
Query: delete from "verification" where "verification"."id" = $1 -- params: ["O3V0Xk2K6oJQAEMYvbD39Ec7cjirh6Gi"]
Query: select "id", "account_id", "provider_id", "user_id", "access_token", "refresh_token", "id_token", "access_token_expires_at", "refresh_token_expires_at", "scope", "password", "created_at", "updated_at" from "account" where ("account"."account_id" = $1 and "account"."provider_id" = $2) -- params: ["100773593187596031594", "google"]
Query: select "id", "name", "email", "email_verified", "image", "created_at", "updated_at", "role", "banned", "ban_reason", "ban_expires", "first_name", "last_name" from "user" where "user"."email" = $1 -- params: ["moaadbn3@gmail.com"]
Query: insert into "user" ("id", "name", "email", "email_verified", "image", "created_at", "updated_at", "role", "banned", "ban_reason", "ban_expires", "first_name", "last_name") values ($1, $2, $3, $4, $5, $6, $7, $8, default, default, default, default, default) returning "id", "name", "email", "email_verified", "image", "created_at", "updated_at", "role", "banned", "ban_reason", "ban_expires", "first_name", "last_name" -- params: ["OxKA7A3BEYp69fKetRWsEfgTFb5erbFu", "Moaad Bn", "moaadbn3@gmail.com", true, "https://lh3.googleusercontent.com/a/ACg8ocJvCkuWM9FS8nxKGUu0ZKjieim49nByBg_k9WNwoE76r0tBvLMb=s96-c", "2025-07-25T17:41:51.630Z", "2025-07-25T17:41:51.630Z", "user"]

*/
