import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";

const countryRatesData = JSON.parse(
  readFileSync(join(process.cwd(), "data", "country-rates.json"), "utf-8")
);

const callCostSchema = z.object({
  fromCountry: z.string().min(2).max(2),
  toCountry: z.string().min(2).max(2),
  minutesPerMonth: z.number().min(0),
});

interface CountryRates {
  voip: number;
  traditional: number;
}

interface CallCostResult {
  costPerMinute: number;
  monthlyCost: number;
  annualCost: number;
  savingsVsTraditional: number;
  comparison: {
    voip: {
      costPerMinute: number;
      monthlyCost: number;
      annualCost: number;
    };
    traditional: {
      costPerMinute: number;
      monthlyCost: number;
      annualCost: number;
    };
  };
}

export default defineEventHandler(async (event): Promise<CallCostResult> => {
  const body = await readBody(event);
  const validated = callCostSchema.parse(body);

  const rates = countryRatesData as Record<string, CountryRates>;

  const toCountryRates = rates[validated.toCountry.toUpperCase()];
  if (!toCountryRates) {
    throw createError({
      statusCode: 400,
      statusMessage: `Rates not available for country: ${validated.toCountry}`,
    });
  }

  const voipCostPerMinute = toCountryRates.voip;
  const traditionalCostPerMinute = toCountryRates.traditional;

  const voipMonthlyCost = voipCostPerMinute * validated.minutesPerMonth;
  const traditionalMonthlyCost = traditionalCostPerMinute * validated.minutesPerMonth;

  const voipAnnualCost = voipMonthlyCost * 12;
  const traditionalAnnualCost = traditionalMonthlyCost * 12;

  const savingsVsTraditional = traditionalMonthlyCost - voipMonthlyCost;

  return {
    costPerMinute: voipCostPerMinute,
    monthlyCost: voipMonthlyCost,
    annualCost: voipAnnualCost,
    savingsVsTraditional,
    comparison: {
      voip: {
        costPerMinute: voipCostPerMinute,
        monthlyCost: voipMonthlyCost,
        annualCost: voipAnnualCost,
      },
      traditional: {
        costPerMinute: traditionalCostPerMinute,
        monthlyCost: traditionalMonthlyCost,
        annualCost: traditionalAnnualCost,
      },
    },
  };
});
