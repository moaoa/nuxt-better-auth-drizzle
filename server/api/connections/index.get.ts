import { defineEventHandler } from "h3";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { googleSheetsAccount, notionAccount } from "~~/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  const db = useDrizzle();

  const notionAccounts = await db.query.notionAccount.findMany({
    where: eq(notionAccount.user_id, user.id),
    columns: {
      uuid: true,
      user_name: true,
    },
  });

  const googleSheetsAccounts = await db.query.googleSheetsAccount.findMany({
    where: eq(googleSheetsAccount.user_id, user.id),
    columns: {
      uuid: true,
      user_name: true,
    },
  });

  return {
    data: {
      notionAccounts,
      googleSheetsAccounts,
    },
  };
});
