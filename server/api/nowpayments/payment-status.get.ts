import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { useDrizzle } from "~~/server/utils/drizzle";
import { requireUserSession } from "~~/server/utils/session";
import { nowPayment } from "~~/db/schema";

const paymentStatusQuerySchema = z.object({
  paymentId: z.coerce.number().int().positive(),
});

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const query = getQuery(event);
  const { paymentId } = paymentStatusQuerySchema.parse(query);

  const db = useDrizzle();
  const payment = await db.query.nowPayment.findFirst({
    where: and(eq(nowPayment.id, paymentId), eq(nowPayment.userId, session.user.id)),
  });

  if (!payment) {
    throw createError({
      statusCode: 404,
      statusMessage: "Payment not found",
    });
  }

  return {
    paymentId: payment.id,
    status: payment.status,
    completedAt: payment.completedAt,
    amountUsd: parseFloat(payment.amountUsd || "0"),
  };
});
