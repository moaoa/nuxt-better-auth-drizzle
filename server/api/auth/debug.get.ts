import { auth } from "~~/lib/auth";

export default defineEventHandler(async (event) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    throw createError({
      statusCode: 404,
      message: "Not found",
    });
  }

  return {
    config: {
      hasBaseURL: !!process.env.BETTER_AUTH_URL,
      baseURL: process.env.BETTER_AUTH_URL,
      hasGoogleClientId: !!process.env.NUXT_GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.NUXT_GOOGLE_CLIENT_SECRET,
      googleClientIdPrefix: process.env.NUXT_GOOGLE_CLIENT_ID?.substring(0, 10) + '...',
    },
    auth: {
      baseURL: auth.config.baseURL,
      basePath: auth.config.basePath,
    },
  };
});

