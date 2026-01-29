import { readBody } from "h3";
import { validateWebhookSignature } from "~~/server/utils/twilio";
import { useRuntimeConfig } from "#imports";
import { useDrizzle } from "~~/server/utils/drizzle";
import { call } from "~~/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const headers = getHeaders(event);
  const signature = headers["x-twilio-signature"];

  if (!signature) {
    throw createError({
      statusCode: 401,
      statusMessage: "Missing Twilio signature",
    });
  }

  // Get request body as form data
  const body = await readBody(event);
  
  // Skip signature validation in development
  const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  
  if (!isDevelopment) {
    // Get full URL for signature validation
    // Twilio signs the request using the URL it calls (the public URL)
    // We need to reconstruct the exact URL Twilio used
    const protocol = headers["x-forwarded-proto"] || "https";
    const host = headers.host || headers["x-original-host"] || "";
    const url = `${protocol}://${host}${event.path}`;

    // Validate signature
    const isValid = validateWebhookSignature(url, body, signature);
    if (!isValid) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid Twilio signature",
      });
    }
  }

  // Get destination number from call parameters
  // For browser calls, Twilio sends 'To' parameter with the destination number
  // For incoming calls, it could be different
  const toNumber = body.To || body.Called || "";
  const callSid = body.CallSid || "";
  const callId = body.CallId; // Custom parameter passed from browser

  // If this is a browser call with CallId, update the call record with the actual Twilio Call SID
  if (callId && callSid) {
    try {
      const db = useDrizzle();
      await db
        .update(call)
        .set({
          twilioCallSid: callSid,
          status: "ringing",
        })
        .where(eq(call.id, parseInt(callId)));
    } catch (error) {
      console.error("Error updating call record:", error);
      // Continue even if update fails
    }
  }

  if (!toNumber) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing destination number",
    });
  }

  // Return TwiML response to dial the destination number
  // This works for both browser-initiated calls and server-initiated calls
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${config.TWILIO_PHONE_NUMBER}">${toNumber}</Dial>
</Response>`;
});

