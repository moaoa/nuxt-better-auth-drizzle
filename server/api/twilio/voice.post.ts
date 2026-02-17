import { readRawBody, setResponseHeader } from "h3";
import { validateWebhookSignature } from "~~/server/utils/twilio";
import { useRuntimeConfig } from "#imports";
import { useDrizzle } from "~~/server/utils/drizzle";
import { call } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { twilioLogger } from "~~/lib/loggers/twilio";
import querystring from "querystring";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const headers = getHeaders(event);
  const signature = headers["x-twilio-signature"];

  // Log incoming webhook request
  twilioLogger.info("Voice webhook received", {
    webhookType: "voice",
    headers: headers,
    timestamp: new Date().toISOString(),
  });

  if (!signature) {
    twilioLogger.warn("Voice webhook missing signature", {
      headers: headers,
      timestamp: new Date().toISOString(),
    });
    throw createError({
      statusCode: 401,
      statusMessage: "Missing Twilio signature",
    });
  }

  // Get request body as URL-encoded form data
  const rawBody = await readRawBody(event, "utf8");
  const rawBodyString = rawBody ? (typeof rawBody === "string" ? rawBody : String(rawBody)) : "";
  const parsedBody = querystring.parse(rawBodyString);
  // Normalize to Record<string, string> (querystring.parse returns string | string[] | undefined)
  const body: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsedBody)) {
    if (value !== undefined) {
      body[key] = Array.isArray(value) ? value[0] || "" : value;
    }
  }
  
  // Log body after reading
  twilioLogger.info("Voice webhook body", {
    webhookType: "voice",
    body: body,
    callSid: body.CallSid,
    toNumber: body.To || body.Called,
    timestamp: new Date().toISOString(),
  });
  
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
      twilioLogger.warn("Voice webhook invalid signature", {
        url: url,
        callSid: body.CallSid,
        timestamp: new Date().toISOString(),
      });
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
      
      twilioLogger.info("Call record updated with Twilio Call SID", {
        callId: callId,
        callSid: callSid,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      twilioLogger.error("Error updating call record", {
        callId: callId,
        callSid: callSid,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      // Continue even if update fails
    }
  }

  if (!toNumber) {
    twilioLogger.warn("Voice webhook missing destination number", {
      body: body,
      callSid: body.CallSid,
      timestamp: new Date().toISOString(),
    });
    throw createError({
      statusCode: 400,
      statusMessage: "Missing destination number",
    });
  }

  // Build the status callback URL for the Dial verb
  // This ensures Twilio sends a "completed" webhook when the child call ends
  const baseUrl = config.public.BETTER_AUTH_URL || "http://localhost:3000";
  const statusCallbackUrl = `${baseUrl}/api/twilio/call-status`;

  // Return TwiML response to dial the destination number
  // This works for both browser-initiated calls and server-initiated calls
  // The action and statusCallbackUrl attributes ensure we get notified when the call ends
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${config.TWILIO_PHONE_NUMBER}" action="${statusCallbackUrl}" statusCallbackEvent="initiated ringing answered completed" statusCallback="${statusCallbackUrl}" statusCallbackMethod="POST">${toNumber}</Dial>
</Response>`;

  twilioLogger.info("Voice webhook processed, returning TwiML", {
    callSid: body.CallSid,
    toNumber: toNumber,
    fromNumber: config.TWILIO_PHONE_NUMBER,
    statusCallbackUrl: statusCallbackUrl,
    twimlResponse: twimlResponse,
    timestamp: new Date().toISOString(),
  });

  // Set Content-Type header for TwiML response (required by Twilio)
  // setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setResponseHeader(event, "Content-Type", "application/xml;");

  return twimlResponse;
});

