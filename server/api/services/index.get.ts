import { service } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";

export default defineEventHandler(async (event) => {
  const db = useDrizzle();
  const services = await db.select().from(service);
  return {
    services,
  };
});
