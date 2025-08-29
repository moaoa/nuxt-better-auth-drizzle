export default defineEventHandler(async (event) => {
  const user = event.context.user;
  const body = await readBody(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const { service, notion_db_id } = body;

  // TODO: Save the notion_db_id for the user and service in the database

  return { success: true };
});
