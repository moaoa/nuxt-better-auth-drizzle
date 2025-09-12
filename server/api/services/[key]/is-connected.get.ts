import { defineEventHandler, getRouterParam } from 'h3'
import { and, eq } from 'drizzle-orm'
import { serviceAccount, service } from '~~/db/schema'
import { useDrizzle } from '~~/server/utils/drizzle'
import { auth } from '~~/lib/auth'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers,
  });

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const serviceKey = getRouterParam(event, 'key')

  if (!serviceKey) {
    throw createError({
      statusCode: 400,
      message: 'Service key is required',
    })
  }

  const db = useDrizzle()

  const [existingServiceAccount] = await db
    .select()
    .from(serviceAccount)
    .innerJoin(service, eq(service.id, serviceAccount.service_id))
    .where(and(eq(serviceAccount.user_id, session.user.id), eq(service.service_key, serviceKey)))
    .limit(1)

  return {
    connected: !!existingServiceAccount,
  }
})
