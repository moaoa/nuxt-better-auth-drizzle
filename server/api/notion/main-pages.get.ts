import { and, eq, isNull, or } from "drizzle-orm";
import { notionAccount, notionEntity } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { requireUserSession } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const {
    user: { id: userId },
  } = await requireUserSession(event);

  const db = useDrizzle();

  const pages = await db
    .select({
      uuid: notionEntity.notionId,
      title: notionEntity.titlePlain,
    })
    .from(notionEntity)
    .leftJoin(notionAccount, eq(notionEntity.accountId, notionAccount.id))
    .where(
      and(
        eq(notionAccount.user_id, userId),
        eq(notionEntity.type, "page"),
        isNull(notionEntity.parentId)
      )
    );

  return pages;
});
