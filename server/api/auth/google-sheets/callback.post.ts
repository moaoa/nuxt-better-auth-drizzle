import { eq } from "drizzle-orm";
import { automationType, googleSheetsAccount } from "~~/db/schema";
import { auth } from "~~/lib/auth";
import { googleSheetsLogger } from "~~/lib/loggers";
import { addGoogleSheetsJob } from "~~/server/queues/googleSheetsQueue";
import { ServiceKey } from "~~/types/services";

interface GoogleOAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleUserInfo {
  name: string;
}

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
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri,
      code,
    });

    const db = useDrizzle();

    const key: ServiceKey = "google_sheet";

    const googleSheetsAutomationType = await db.query.automationType.findFirst({
      where: eq(automationType.automationTypeKey, key),
      columns: {
        id: true,
      },
    });

    if (!googleSheetsAutomationType) {
      throw createError({
        statusCode: 404,
        message: "Google Sheets Automation Type not found.",
      });
    }

    const encodedApiKey = Buffer.from(
      `${config.public.GOOGLE_SHEETS_CLIENT_ID}:${config.GOOGLE_SHEETS_CLIENT_SECRET}`
    ).toString("base64");

    const response = await $fetch<GoogleOAuthResponse>(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${encodedApiKey}`,
        },
        body,
      }
    );

    const userInfo = await $fetch<GoogleUserInfo>(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${response.access_token}`,
        },
      }
    );

    const session = await auth.api.getSession({
      headers: event.headers,
    });

    if (!session) throw new Error("Session not found");

    //TODO: remove the google sheets id col and make the user id unique
    await db
      .insert(googleSheetsAccount)
      .values({
        googleSheetsId: crypto.randomUUID(),
        access_token: response.access_token,
        token_type: response.token_type,
        user_id: session.user.id,
        user_name: userInfo.name,
        revoked_at: null,
        refresh_token: response.refresh_token,
        createdAt: new Date(),
        updatedAt: new Date(),
        scope: response.scope,
        expiry_date: new Date(
          new Date().getTime() + response.expires_in * 1000
        ),
      })
      .onConflictDoUpdate({
        target: [
          googleSheetsAccount.user_id,
          //TODO: remove the google sheets id all together and make the user id only unique
          googleSheetsAccount.googleSheetsId,
        ],
        set: {
          access_token: response.access_token,
          token_type: response.token_type,
          user_name: userInfo.name,
          revoked_at: null,
          refresh_token: response.refresh_token,
          updatedAt: new Date(),
          scope: response.scope,
          expiry_date: new Date(
            new Date().getTime() + response.expires_in * 1000
          ),
        },
      });

    console.log("before starting job");

    await addGoogleSheetsJob({
      userId: session.user.id,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
    });

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "no message";
    console.error("Error exchanging code for token:", msg);

    googleSheetsLogger.error({ body, error });

    throw createError({
      statusCode: 500,
      message: "Failed to exchange code for token: " + msg,
      cause: error,
    });
  }
});
