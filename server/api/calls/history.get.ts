import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { call, callCostBreakdown } from "~~/db/schema";
import { eq, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const query = getQuery(event);

  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const db = useDrizzle();

  // Get calls for user with cost breakdown
  const calls = await db.query.call.findMany({
    where: eq(call.userId, session.user.id),
    orderBy: [desc(call.createdAt)],
    limit,
    offset,
    with: {
      costBreakdown: true,
    },
  });

  // Get total count
  const totalCalls = await db
    .select({ count: call.id })
    .from(call)
    .where(eq(call.userId, session.user.id));

  // Format calls with cost information
  const formattedCalls = calls.map((callRecord) => {
    const cost = callRecord.costBreakdown;
    return {
      ...callRecord,
      cost: cost
        ? {
            userPriceUsd: cost.userPriceUsd ? parseFloat(cost.userPriceUsd) : null,
            twilioPriceUsd: cost.twilioPriceUsd ? parseFloat(cost.twilioPriceUsd) : null,
            durationSeconds: cost.twilioDurationSeconds || callRecord.durationSeconds,
          }
        : null,
    };
  });

  return {
    calls: formattedCalls,
    pagination: {
      page,
      limit,
      total: totalCalls.length,
      totalPages: Math.ceil(totalCalls.length / limit),
    },
  };
});





