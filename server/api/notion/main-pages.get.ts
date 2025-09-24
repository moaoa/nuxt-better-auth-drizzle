import { and, eq } from "drizzle-orm";
import { notionAccount, notionEntity } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { requireUserSession } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const {
    user: { id: userId },
  } = await requireUserSession(event);

  const db = useDrizzle();

  const pages = await db.query.notionEntity.findMany({
    with: {
      account: {
        with: { user: true },
      },
    },
    where: and(
      eq(notionAccount.user_id, userId),
      eq(notionEntity.type, "page"),
      eq(notionEntity.parentId, "")
    ),
  });

  return pages;
});
