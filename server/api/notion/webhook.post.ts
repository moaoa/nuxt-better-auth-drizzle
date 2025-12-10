export default defineEventHandler(async (event) => {
  // Log request details
  console.log("--- Notion Webhook Request ---");
  console.log(`Method: ${event.node.req.method}`);
  console.log(`URL: ${event.node.req.url}`);
  console.log(`Headers:`, event.node.req.headers);

  // Read request body
  const body = await readBody(event).catch(() => null);
  if (body) {
    console.log(`Body:`, body);
  }

  console.log("--- End Notion Webhook Request ---\n");

  return { status: "ok", message: "Webhook received" };
});

