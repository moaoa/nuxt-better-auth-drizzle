import { googleSheetsAccount } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "~~/lib/auth";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers,
  });

  if (!session) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const db = useDrizzle();

  const account = await db.query.googleSheetsAccount.findFirst({
    where: eq(googleSheetsAccount.user_id, session.user.id),
  });

  if (!account) {
    throw createError({
      statusCode: 404,
      message: "Google Sheets account not found",
    });
  }

  const sheets = await db.query.googleSpreadsheet.findMany({
    where: eq(googleSheetsAccount.user_id, session.user.id),
    columns: {
      id: false,
    },
  });

  return {
    sheets,
  };
});
