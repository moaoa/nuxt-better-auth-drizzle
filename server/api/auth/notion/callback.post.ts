import { notionConfig } from "../../../../config/notion.config";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;

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
        Authorization: `Basic ${Buffer.from(
          `${notionConfig.clientId}:${notionConfig.clientSecret}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: notionConfig.redirectUri,
      }),
    });

    return response;
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to exchange code for token",
    });
  }
});
