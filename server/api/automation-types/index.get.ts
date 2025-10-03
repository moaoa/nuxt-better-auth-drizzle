import { useDrizzle } from "~~/server/utils/drizzle";

export default defineEventHandler(async (event) => {
  const db = useDrizzle();
  const automationTypes = await db.query.automationType.findMany({
    columns: {
      id: false,
    },
  });
  return {
    automationTypes,
  };
});
