import { requireUserSession } from "~~/server/utils/session";
import twilio from "twilio";
import { useRuntimeConfig } from "#imports";

/**
 * Generate a Twilio Access Token for browser-based calling
 * This token allows the browser to connect to Twilio Voice SDK
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const config = useRuntimeConfig();

  // Validate required credentials
  if (!config.TWILIO_ACCOUNT_SID) {
    throw createError({
      statusCode: 500,
      statusMessage: "TWILIO_ACCOUNT_SID is not configured",
    });
  }

  // Determine which credentials to use
  const useApiKey = !!(
    config.TWILIO_API_KEY_SID && config.TWILIO_API_KEY_SECRET
  );
  const useAuthToken = !!config.TWILIO_AUTH_TOKEN;

  if (!useApiKey && !useAuthToken) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Either TWILIO_AUTH_TOKEN or both TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET must be configured",
    });
  }

  if (
    useApiKey &&
    (!config.TWILIO_API_KEY_SID || !config.TWILIO_API_KEY_SECRET)
  ) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Both TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET must be provided together",
    });
  }

  // Generate a unique identity for this user (can use user ID or email)
  const identity = session.user.id;

  // Create access token with Voice grant
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  // Get the base URL for the voice webhook
  // Must be publicly accessible (use HTTPS in production)
  const baseUrl = config.public.BETTER_AUTH_URL || "http://localhost:3000";
  const voiceUrl = `${baseUrl}/api/twilio/voice`;

  // Create a voice grant with outgoing configuration
  // CRITICAL: For browser-to-phone calls, TwiML App SID is REQUIRED
  // VoiceGrant does NOT support outgoingApplicationUri - only outgoingApplicationSid
  // Create a TwiML App in Twilio Console: https://console.twilio.com/us1/develop/runtime/twiml-apps
  // Set the Voice URL to: https://yourdomain.com/api/twilio/voice (or http://localhost:3000/api/twilio/voice for local dev)

  if (!config.TWILIO_APP_SID) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "TWILIO_APP_SID is required for browser calling. Please create a TwiML App in Twilio Console and set TWILIO_APP_SID in your .env file. See: https://console.twilio.com/us1/develop/runtime/twiml-apps",
    });
  }

  const voiceGrant = new VoiceGrant({
    incomingAllow: true,
    outgoingApplicationSid: config.TWILIO_APP_SID,
  });

  // Create the access token
  // Use API Key if available, otherwise use Auth Token
  const signingKeySid = useApiKey
    ? config.TWILIO_API_KEY_SID!
    : config.TWILIO_ACCOUNT_SID;
  const signingKeySecret = useApiKey
    ? config.TWILIO_API_KEY_SECRET!
    : config.TWILIO_AUTH_TOKEN!;

  const token = new AccessToken(
    config.TWILIO_ACCOUNT_SID,
    signingKeySid,
    signingKeySecret,
    {
      identity: identity,
      ttl: 3600, // Token expires in 1 hour
    }
  );

  token.addGrant(voiceGrant);

  const jwtToken = token.toJwt();

  return {
    token: jwtToken,
    identity: identity,
  };
});
