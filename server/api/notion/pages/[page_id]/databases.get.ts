
import { and, eq } from "drizzle-orm";
import { notionEntity } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { requireUserSession } from "~~/server/utils/session";
import { validateDb } from "~~/server/utils/services";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const pageId = event.context.params.page_id;
  const { service_key } = getQuery(event);

  const db = useDrizzle();

  const databases = await db.query.notionEntity.findMany({
    where: and(eq(notionEntity.parentId, pageId), eq(notionEntity.type, "database")),
  });

  const databasesWithCompatibility = databases.map((database) => ({
    ...database,
    is_compatible: validateDb(database, service_key as string),
  }));

  return databasesWithCompatibility;
});
