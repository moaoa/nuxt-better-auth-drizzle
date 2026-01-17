<script setup lang="ts">
import { getCountries } from "libphonenumber-js";

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

const fromCountry = ref("US");
const toCountry = ref("GB");
const minutesPerMonth = ref(100);
const isCalculating = ref(false);
const result = ref<CallCostResult | null>(null);
const error = ref<string | null>(null);

const countries = getCountries();

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "International Call Cost Calculator - Free Tool",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Calculate international calling costs instantly. Compare rates, estimate monthly expenses, and find the best calling solution.",
  url: "https://yourdomain.com/tools/international-call-cost-calculator",
};

const calculateCost = async () => {
  if (minutesPerMonth.value < 0) {
    error.value = "Minutes per month must be a positive number";
    return;
  }

  isCalculating.value = true;
  error.value = null;
  result.value = null;

  try {
    const response = await $fetch<CallCostResult>("/api/tools/international-call-cost", {
      method: "POST",
      body: {
        fromCountry: fromCountry.value,
        toCountry: toCountry.value,
        minutesPerMonth: minutesPerMonth.value,
      },
    });
    result.value = response;
  } catch (err) {
    if (err instanceof Error) {
      error.value = err.message;
      return;
    }
    error.value = "An error occurred while calculating costs";
  } finally {
    isCalculating.value = false;
  }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};
</script>

<template>
  <ToolLayout
    title="International Call Cost Calculator"
    description="Calculate international calling costs instantly. Compare rates, estimate monthly expenses, and find cost savings. Free calculator tool."
    :structured-data="structuredData"
  >
    <!-- Calculator Form -->
    <div class="bg-card border rounded-lg p-6 mb-8">
      <form @submit.prevent="calculateCost" class="space-y-4">
        <div>
          <label for="fromCountry" class="block text-sm font-medium mb-2">
            From Country
          </label>
          <select
            id="fromCountry"
            v-model="fromCountry"
            class="w-full px-4 py-2 border rounded-md"
          >
            <option v-for="country in countries" :key="country" :value="country">
              {{ country }}
            </option>
          </select>
        </div>

        <div>
          <label for="toCountry" class="block text-sm font-medium mb-2">
            To Country
          </label>
          <select
            id="toCountry"
            v-model="toCountry"
            class="w-full px-4 py-2 border rounded-md"
          >
            <option v-for="country in countries" :key="country" :value="country">
              {{ country }}
            </option>
          </select>
        </div>

        <div>
          <label for="minutesPerMonth" class="block text-sm font-medium mb-2">
            Minutes per Month
          </label>
          <input
            id="minutesPerMonth"
            v-model.number="minutesPerMonth"
            type="number"
            min="0"
            step="1"
            class="w-full px-4 py-2 border rounded-md"
            required
          />
        </div>

        <button
          type="submit"
          :disabled="isCalculating"
          class="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {{ isCalculating ? "Calculating..." : "Calculate Cost" }}
        </button>
      </form>

      <div v-if="error" class="mt-4 p-4 bg-destructive/10 text-destructive rounded-md">
        {{ error }}
      </div>
    </div>

    <!-- Results -->
    <div v-if="result" class="bg-card border rounded-lg p-6 mb-8">
      <h2 class="text-2xl font-semibold mb-4">Cost Breakdown</h2>

      <div class="space-y-6">
        <!-- VoIP Costs -->
        <div class="border rounded-lg p-4">
          <h3 class="text-lg font-semibold mb-3">VoIP Calling</h3>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span>Cost per minute:</span>
              <span class="font-semibold">{{ formatCurrency(result.comparison.voip.costPerMinute) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Monthly cost:</span>
              <span class="font-semibold">{{ formatCurrency(result.comparison.voip.monthlyCost) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Annual cost:</span>
              <span class="font-semibold">{{ formatCurrency(result.comparison.voip.annualCost) }}</span>
            </div>
          </div>
        </div>

        <!-- Traditional Costs -->
        <div class="border rounded-lg p-4">
          <h3 class="text-lg font-semibold mb-3">Traditional Calling</h3>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span>Cost per minute:</span>
              <span class="font-semibold">
                {{ formatCurrency(result.comparison.traditional.costPerMinute) }}
              </span>
            </div>
            <div class="flex justify-between">
              <span>Monthly cost:</span>
              <span class="font-semibold">
                {{ formatCurrency(result.comparison.traditional.monthlyCost) }}
              </span>
            </div>
            <div class="flex justify-between">
              <span>Annual cost:</span>
              <span class="font-semibold">
                {{ formatCurrency(result.comparison.traditional.annualCost) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Savings -->
        <div
          v-if="result.savingsVsTraditional > 0"
          class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
        >
          <h3 class="text-lg font-semibold mb-2 text-green-700 dark:text-green-300">
            Monthly Savings with VoIP
          </h3>
          <p class="text-2xl font-bold text-green-700 dark:text-green-300">
            {{ formatCurrency(result.savingsVsTraditional) }}
          </p>
          <p class="text-sm text-green-600 dark:text-green-400 mt-1">
            Save {{ formatCurrency(result.savingsVsTraditional * 12) }} per year
          </p>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="bg-primary/10 border border-primary rounded-lg p-6 text-center">
      <h3 class="text-xl font-semibold mb-2">
        Save money by calling internationally with YourAppName
      </h3>
      <p class="text-muted-foreground mb-4">
        Get low international rates and save up to 70% on calling costs
      </p>
      <NuxtLink
        to="/register"
        class="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90"
      >
        Get Started Free
      </NuxtLink>
    </div>
  </ToolLayout>
</template>
