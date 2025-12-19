import { and, eq } from "drizzle-orm";
import { notionAccount, notionEntity } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { requireUserSession } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  const db = useDrizzle();

  const databases = await db
    .select({
      uuid: notionEntity.notionId,
      title: notionEntity.titlePlain,
    })
    .from(notionEntity)
    .leftJoin(notionAccount, eq(notionEntity.accountId, notionAccount.id))
    .where(
      and(
        eq(notionAccount.user_id, user.id),
        eq(notionEntity.type, "database")
      )
    );

  return databases;
});

