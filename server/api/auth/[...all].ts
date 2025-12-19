import { auth } from "~~/lib/auth";

export default defineEventHandler(async (event) => {
  try {
    return await auth.handler(toWebRequest(event));
  } catch (error: any) {
    console.error("Better Auth Error:", {
      message: error?.message,
      stack: error?.stack,
      cause: error?.cause,
      statusCode: error?.statusCode,
      statusMessage: error?.statusMessage,
    });
    
    // Re-throw with more context
    throw createError({
      statusCode: error?.statusCode || 500,
      statusMessage: error?.statusMessage || "Authentication Error",
      message: error?.message || "An error occurred during authentication",
      data: {
        originalError: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
    });
  }
});
