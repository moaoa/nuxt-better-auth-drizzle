import { z } from "zod";
import { parsePhoneNumber, isValidPhoneNumber, type CountryCode } from "libphonenumber-js";
import { getClientIP } from "h3";

const phoneCheckerSchema = z.object({
  phoneNumber: z.string().min(1),
  country: z.string().optional(),
});

interface PhoneCheckerResult {
  valid: boolean;
  country: string;
  carrier?: string;
  lineType?: string;
  e164: string;
  nationalFormat: string;
  internationalFormat: string;
}

export default defineEventHandler(async (event): Promise<PhoneCheckerResult> => {
  const body = await readBody(event);
  const validated = phoneCheckerSchema.parse(body);

  // Try to parse and validate the phone number
  let parsed;
  try {
    const countryCode = validated.country ? (validated.country as CountryCode) : undefined;
    parsed = parsePhoneNumber(validated.phoneNumber, countryCode);
  } catch (error) {
    return {
      valid: false,
      country: "Unknown",
      e164: validated.phoneNumber,
      nationalFormat: validated.phoneNumber,
      internationalFormat: validated.phoneNumber,
    };
  }

  if (!parsed) {
    return {
      valid: false,
      country: "Unknown",
      e164: validated.phoneNumber,
      nationalFormat: validated.phoneNumber,
      internationalFormat: validated.phoneNumber,
    };
  }

  const isValid = isValidPhoneNumber(validated.phoneNumber, parsed.country);

  // Get formats
  const e164 = parsed.number || validated.phoneNumber;
  let nationalFormat = validated.phoneNumber;
  let internationalFormat = validated.phoneNumber;

  try {
    nationalFormat = parsed.formatNational();
  } catch (error) {
    // Keep original if formatting fails
  }

  try {
    internationalFormat = parsed.formatInternational();
  } catch (error) {
    // Keep original if formatting fails
  }

  // Note: Carrier and line type would require a paid API like Twilio Lookup
  // For now, we'll return basic validation results
  return {
    valid: isValid,
    country: parsed.country || "Unknown",
    e164,
    nationalFormat,
    internationalFormat,
  };
});
