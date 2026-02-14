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

  // Validate Account SID format (should start with "AC")
  if (!config.TWILIO_ACCOUNT_SID.startsWith("AC")) {
    console.warn(
      "TWILIO_ACCOUNT_SID does not start with 'AC'. This might indicate an incorrect Account SID."
    );
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

  // Generate a unique identity for this user (must be a string)
  // Ensure identity is a string and doesn't contain invalid characters
  const identity = String(session.user.id).trim();
  
  if (!identity || identity.length === 0) {
    throw createError({
      statusCode: 500,
      statusMessage: "Invalid user identity for token generation",
    });
  }

  // Create access token with Voice grant
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const baseUrl = config.public.BETTER_AUTH_URL || "http://localhost:3000";
  const voiceUrl = `${baseUrl}/api/twilio/voice`;

  if (!config.TWILIO_APP_SID) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "TWILIO_APP_SID is required for browser calling. Please create a TwiML App in Twilio Console and set TWILIO_APP_SID in your .env file. See: https://console.twilio.com/us1/develop/runtime/twiml-apps",
    });
  }

  // Validate App SID format (should start with "AP")
  if (!config.TWILIO_APP_SID.startsWith("AP")) {
    console.warn(
      "TWILIO_APP_SID does not start with 'AP'. This might indicate an incorrect App SID."
    );
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

  // Validate that credentials are not empty strings
  if (!signingKeySid || !signingKeySecret) {
    throw createError({
      statusCode: 500,
      statusMessage: "Twilio credentials are missing or invalid",
    });
  }

  // Check for placeholder values
  const placeholderPatterns = [
    "a-string-secret-at-least-256-bits-long",
    "your_",
    "example",
    "placeholder",
    "change-me",
    "TODO",
  ];
  const isPlaceholder = (value: string): boolean => {
    return placeholderPatterns.some(pattern => 
      value.toLowerCase().includes(pattern.toLowerCase())
    );
  };

  if (isPlaceholder(signingKeySecret)) {
    console.error("⚠️ CRITICAL: Signing key secret appears to be a placeholder value!");
    console.error("First 20 chars:", signingKeySecret.substring(0, 20));
    throw createError({
      statusCode: 500,
      statusMessage: "Twilio Auth Token or API Key Secret appears to be a placeholder value. Please set the actual value in your .env file.",
      message: `The signing secret starts with: "${signingKeySecret.substring(0, 30)}..." which looks like a placeholder. Please update your TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SECRET in your .env file with the actual value from Twilio Console.`,
    });
  }

  // Verify Account SID matches signing key SID when using Auth Token
  if (!useApiKey && signingKeySid !== config.TWILIO_ACCOUNT_SID) {
    console.error("⚠️ WARNING: Signing key SID doesn't match Account SID when using Auth Token!");
    throw createError({
      statusCode: 500,
      statusMessage: "Account SID and Signing Key SID mismatch",
    });
  }

  // Validate API Key SID format if using API Key (should start with "SK")
  if (useApiKey && !signingKeySid.startsWith("SK")) {
    console.warn(
      "TWILIO_API_KEY_SID does not start with 'SK'. This might indicate an incorrect API Key SID."
    );
  }

  try {
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
  } catch (error: any) {
    console.error("Failed to generate Twilio access token:", {
      error: error.message,
      accountSid: config.TWILIO_ACCOUNT_SID?.substring(0, 10) + "...",
      identity: identity,
      usingApiKey: useApiKey,
      appSid: config.TWILIO_APP_SID?.substring(0, 10) + "...",
      expectedVoiceUrl: voiceUrl,
    });
    
    // Provide helpful troubleshooting information
    const troubleshootingTips = [
      "Verify TWILIO_ACCOUNT_SID is correct (should start with 'AC')",
      "Verify TWILIO_AUTH_TOKEN or API Key credentials are correct",
      "Verify TWILIO_APP_SID is correct (should start with 'AP') and belongs to the same account",
      `Ensure TwiML App Voice URL is set to: ${voiceUrl}`,
      "Check that all credentials belong to the same Twilio account",
    ];
    
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to generate access token",
      message: `${error.message || "Unknown error during token generation"}. Troubleshooting: ${troubleshootingTips.join("; ")}`,
    });
  }
});
