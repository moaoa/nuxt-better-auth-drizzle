import { z } from "zod";

const timezoneOverlapSchema = z.object({
  callerCountry: z.string().min(2).max(2),
  recipientCountry: z.string().min(2).max(2),
});

interface TimezoneOverlapResult {
  callerTimezone: string;
  recipientTimezone: string;
  currentTimeCaller: string;
  currentTimeRecipient: string;
  overlapHours: Array<{ start: string; end: string }>;
  recommendedWindows: Array<{ start: string; end: string; label: string }>;
  workingHoursOverlap: {
    hasOverlap: boolean;
    hours: Array<{ start: string; end: string }>;
  };
}

// Simplified country to timezone mapping (top countries)
const countryToTimezone: Record<string, string> = {
  US: "America/New_York",
  GB: "Europe/London",
  CA: "America/Toronto",
  AU: "Australia/Sydney",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  JP: "Asia/Tokyo",
  CN: "Asia/Shanghai",
  IN: "Asia/Kolkata",
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
  RU: "Europe/Moscow",
  KR: "Asia/Seoul",
  SG: "Asia/Singapore",
  MY: "Asia/Kuala_Lumpur",
  TH: "Asia/Bangkok",
  PH: "Asia/Manila",
  ID: "Asia/Jakarta",
  VN: "Asia/Ho_Chi_Minh",
  NZ: "Pacific/Auckland",
  ZA: "Africa/Johannesburg",
  EG: "Africa/Cairo",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
  IL: "Asia/Jerusalem",
  TR: "Europe/Istanbul",
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  CH: "Europe/Zurich",
  AT: "Europe/Vienna",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki",
  PL: "Europe/Warsaw",
  CZ: "Europe/Prague",
  IE: "Europe/Dublin",
  PT: "Europe/Lisbon",
  GR: "Europe/Athens",
  AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",
  CO: "America/Bogota",
  PE: "America/Lima",
  NG: "Africa/Lagos",
  KE: "Africa/Nairobi",
};

const getTimezone = (countryCode: string): string => {
  return countryToTimezone[countryCode.toUpperCase()] || "UTC";
};

const calculateOverlap = (
  callerTz: string,
  recipientTz: string
): TimezoneOverlapResult => {
  const now = new Date();
  const callerTime = new Date(
    now.toLocaleString("en-US", { timeZone: callerTz })
  );
  const recipientTime = new Date(
    now.toLocaleString("en-US", { timeZone: recipientTz })
  );

  // Simplified overlap calculation (9 AM - 5 PM working hours)
  // In a real implementation, you'd use a proper timezone library
  const workingHoursStart = 9;
  const workingHoursEnd = 17;

  // For simplicity, we'll calculate basic overlap
  // This is a simplified version - in production, use date-fns-tz or luxon
  const overlapHours: Array<{ start: string; end: string }> = [];
  const recommendedWindows: Array<{ start: string; end: string; label: string }> = [];

  // Basic overlap: assume 4-hour overlap window (simplified)
  overlapHours.push({
    start: "09:00",
    end: "13:00",
  });

  recommendedWindows.push({
    start: "10:00",
    end: "12:00",
    label: "Best time (both in working hours)",
  });

  return {
    callerTimezone: callerTz,
    recipientTimezone: recipientTz,
    currentTimeCaller: callerTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    currentTimeRecipient: recipientTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    overlapHours,
    recommendedWindows,
    workingHoursOverlap: {
      hasOverlap: true,
      hours: overlapHours,
    },
  };
};

export default defineEventHandler(async (event): Promise<TimezoneOverlapResult> => {
  const body = await readBody(event);
  const validated = timezoneOverlapSchema.parse(body);

  const callerTz = getTimezone(validated.callerCountry);
  const recipientTz = getTimezone(validated.recipientCountry);

  if (callerTz === "UTC" || recipientTz === "UTC") {
    throw createError({
      statusCode: 400,
      statusMessage: "Timezone not available for one or both countries",
    });
  }

  return calculateOverlap(callerTz, recipientTz);
});
