import { auth } from "~~/lib/auth";
import { automation, service } from "~~/db/schema";
import { getNextId } from "~~/lib/utils";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });

  const db = useDrizzle();

  const body = await readBody(event);

  const serviceUUID = body.service_id;

  const _service = await db.query.service.findFirst({
    where: eq(service.uuid, serviceUUID),
  });

  if (!_service) {
    throw createError({
      statusCode: 404,
      message: "Service not found.",
    });
  }

  try {
    const nextAutomationId = await getNextId(db, automation, automation.id);

    const newAutomation = await db
      .insert(automation)
      .values({
        id: nextAutomationId,
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
