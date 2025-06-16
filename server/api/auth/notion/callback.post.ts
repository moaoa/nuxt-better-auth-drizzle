import { notionConfig } from "../../../../config/notion.config";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const code = body.code as string;

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "No code provided",
    });
  }

  try {
    const response = await $fetch(notionConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
        Authorization: `Basic ${Buffer.from(
          `${notionConfig.clientId}:${notionConfig.clientSecret}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        // redirect_uri: notionConfig.redirectUri,
        redirect_uri: "http://localhost:3000/auth/notion/callback",
      }),
    });

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "no message";
    console.error("Error exchanging code for token:", msg);

    throw createError({
      statusCode: 500,
      message: "Failed to exchange code for token: " + msg,
    });
  }
});
