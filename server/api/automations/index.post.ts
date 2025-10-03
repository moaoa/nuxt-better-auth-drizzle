import { auth } from "~~/lib/auth";
import { automation, automationType, user } from "~~/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });

  const db = useDrizzle();

  const body = await readBody(event);

  const serviceUUID = body.service_id;

  const _service = await db.query.service.findFirst({
    where: eq(automationType.uuid, serviceUUID),
  });

  if (!_service) {
    throw createError({
      statusCode: 404,
      message: "Service not found.",
    });
  }

  try {
    const newAutomation = await db
      .insert(automation)
      .values({
        uuid: crypto.randomUUID(),
        name: "QuickBooks to Notion Sync",
        description: "Automated synchronization of QuickBooks data to Notion.",
        user_id: session!.user.id,
        service_id: _service.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return newAutomation;
  } catch (error) {
    console.error("Error creating automation record:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create automation record.",
    });
  }
});
