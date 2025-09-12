import { useDrizzle } from "~~/server/utils/drizzle";

export default defineEventHandler(async (event) => {
  const db = useDrizzle();
  const services = await db.query.service.findMany({
    columns: {
      id: false,
    },
  });
  return {
    services,
  };
});
