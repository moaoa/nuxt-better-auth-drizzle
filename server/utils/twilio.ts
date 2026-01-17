import twilio from "twilio";
import crypto from "crypto";
import { parsePhoneNumber, isValidPhoneNumber, type CountryCode } from "libphonenumber-js";

// Initialize Twilio client (will be created per request)
function getTwilioClient() {
  const config = useRuntimeConfig();
  return twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
}

export interface TwilioCall {
  sid: string;
  status: string;
  from: string;
  to: string;
  duration?: string;
}

/**
 * Initiate a call via Twilio REST API
 * @param from - Source phone number (E.164 format)
 * @param to - Destination phone number (E.164 format)
 * @param webhookUrl - URL for Twilio status callbacks
 * @param voiceUrl - URL for TwiML instructions (with To parameter)
 * @returns Twilio call object
 */
export async function initiateCall(
  from: string,
  to: string,
  webhookUrl: string,
  voiceUrl: string
): Promise<TwilioCall> {
  const twilioClient = getTwilioClient();

  const call = await twilioClient.calls.create({
    from: from,
    to: to,
    url: voiceUrl,
    statusCallback: webhookUrl,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    statusCallbackMethod: "POST",
  });

  return {
    sid: call.sid,
    status: call.status,
    from: call.from,
    to: call.to,
  };
}

/**
 * End a call via Twilio REST API
 * @param callSid - Twilio Call SID
 */
export async function endCall(callSid: string): Promise<void> {
  const twilioClient = getTwilioClient();
  await twilioClient.calls(callSid).update({ status: "completed" });
}

/**
 * Get voice rate for a country (from Twilio Pricing API or local table)
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @param callType - Type of call (mobile, landline, toll-free)
 * @returns Rate per minute in USD
 */
export async function getVoiceRate(
  countryCode: string,
  callType: "mobile" | "landline" | "toll-free" = "mobile"
): Promise<number> {
  try {
    const twilioClient = getTwilioClient();
    // Try to fetch from Twilio Pricing API
    const pricing = await twilioClient.pricing.v1.voice.countries(countryCode).fetch();
    
    // Get the rate for the call type
    let rate: number | undefined;
    if (callType === "mobile" && pricing.outboundPrefixPrices) {
      const mobilePrice = pricing.outboundPrefixPrices.find(
        (p) => p.friendlyName?.toLowerCase().includes("mobile")
      );
      rate = mobilePrice?.basePrice ? parseFloat(mobilePrice.basePrice) : undefined;
    } else if (callType === "landline" && pricing.outboundPrefixPrices) {
      const landlinePrice = pricing.outboundPrefixPrices.find(
        (p) => !p.friendlyName?.toLowerCase().includes("mobile")
      );
      rate = landlinePrice?.basePrice ? parseFloat(landlinePrice.basePrice) : undefined;
    }

    if (rate !== undefined) {
      return rate;
    }

    // Fallback: use first available rate or default
    if (pricing.outboundPrefixPrices && pricing.outboundPrefixPrices.length > 0) {
      return parseFloat(pricing.outboundPrefixPrices[0].basePrice || "0.01");
    }

    // Default fallback rate
    return 0.01;
  } catch (error) {
    console.error(`Error fetching Twilio rate for ${countryCode}:`, error);
    // Default fallback rate
    return 0.01;
  }
}

/**
 * Validate Twilio webhook signature
 * @param url - Full URL of the webhook endpoint
 * @param params - Request parameters (body)
 * @param signature - X-Twilio-Signature header value
 * @returns true if signature is valid
 */
export function validateWebhookSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const config = useRuntimeConfig();
  const authToken = config.TWILIO_WEBHOOK_SECRET;

  // Create the signature string
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      return acc + key + params[key];
    }, url);

  // Create HMAC SHA1 hash
  const computedSignature = crypto
    .createHmac("sha1", authToken)
    .update(data, "utf-8")
    .digest("base64");

  // Compare signatures (constant-time comparison)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

/**
 * Extract country code from E.164 phone number
 * @param phoneNumber - E.164 format phone number (e.g., +1234567890)
 * @returns ISO 3166-1 alpha-2 country code (e.g., "LY" for Libya, "US" for USA)
 */
export function extractCountryCode(phoneNumber: string): string {
  try {
    const parsed = parsePhoneNumber(phoneNumber);
    if (parsed && parsed.country) {
      return parsed.country;
    }
  } catch (error) {
    console.error(`Error parsing phone number ${phoneNumber}:`, error);
  }
  
  // Fallback to US if parsing fails
  return "US";
}

/**
 * Validate E.164 phone number format and ensure it's a valid phone number
 * Supports all countries including Libya (+218)
 * @param phoneNumber - Phone number to validate (E.164 format)
 * @returns true if valid E.164 format and valid phone number
 */
export function isValidE164(phoneNumber: string): boolean {
  // First check basic E.164 format: +[country code][number] (max 15 digits after +)
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (!e164Regex.test(phoneNumber)) {
    return false;
  }

  // Then validate using libphonenumber-js to ensure it's a valid phone number
  // This will properly validate Libyan numbers (+218) and all other countries
  try {
    return isValidPhoneNumber(phoneNumber);
  } catch (error) {
    console.error(`Error validating phone number ${phoneNumber}:`, error);
    return false;
  }
}

