
import { and, eq } from "drizzle-orm";
import { notionEntity } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { requireUserSession } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const pageId = event.context.params.page_id;
  const { service_key } = getQuery(event);

  const db = useDrizzle();

  // TODO: Implement the logic to get databases for the given pageId

  return [];
});
