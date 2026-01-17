<script setup lang="ts">
import { getCountries } from "libphonenumber-js";

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

const callerCountry = ref("US");
const recipientCountry = ref("GB");
const isCalculating = ref(false);
const result = ref<TimezoneOverlapResult | null>(null);
const error = ref<string | null>(null);

const countries = getCountries();

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Best Time to Call Internationally - Free Tool",
  applicationCategory: "UtilityApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Find the best time to call internationally. Calculate timezone overlaps, working hours, and get personalized calling window recommendations.",
  url: "https://yourdomain.com/tools/best-time-to-call-internationally",
};

const calculateOverlap = async () => {
  isCalculating.value = true;
  error.value = null;
  result.value = null;

  try {
    const response = await $fetch<TimezoneOverlapResult>("/api/tools/timezone-overlap", {
      method: "POST",
      body: {
        callerCountry: callerCountry.value,
        recipientCountry: recipientCountry.value,
      },
    });
    result.value = response;
  } catch (err) {
    if (err instanceof Error) {
      error.value = err.message;
      return;
    }
    error.value = "An error occurred while calculating timezone overlap";
  } finally {
    isCalculating.value = false;
  }
};
</script>

<template>
  <ToolLayout
    title="Best Time to Call Internationally"
    description="Find the optimal calling times for any country pair. Calculate timezone overlaps, working hours, and get personalized calling window recommendations. Free tool."
    :structured-data="structuredData"
  >
    <!-- Tool Form -->
    <div class="bg-card border rounded-lg p-6 mb-8">
      <form @submit.prevent="calculateOverlap" class="space-y-4">
        <div>
          <label for="callerCountry" class="block text-sm font-medium mb-2">
            Your Country
          </label>
          <select
            id="callerCountry"
            v-model="callerCountry"
            class="w-full px-4 py-2 border rounded-md"
          >
            <option v-for="country in countries" :key="country" :value="country">
              {{ country }}
            </option>
          </select>
        </div>

        <div>
          <label for="recipientCountry" class="block text-sm font-medium mb-2">
            Recipient Country
          </label>
          <select
            id="recipientCountry"
            v-model="recipientCountry"
            class="w-full px-4 py-2 border rounded-md"
          >
            <option v-for="country in countries" :key="country" :value="country">
              {{ country }}
            </option>
          </select>
        </div>

        <button
          type="submit"
          :disabled="isCalculating"
          class="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {{ isCalculating ? "Calculating..." : "Find Best Time" }}
        </button>
      </form>

      <div v-if="error" class="mt-4 p-4 bg-destructive/10 text-destructive rounded-md">
        {{ error }}
      </div>
    </div>

    <!-- Results -->
    <div v-if="result" class="bg-card border rounded-lg p-6 mb-8">
      <h2 class="text-2xl font-semibold mb-4">Timezone Information</h2>

      <div class="space-y-6">
        <!-- Current Times -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="border rounded-lg p-4">
            <h3 class="font-semibold mb-2">Your Current Time</h3>
            <p class="text-2xl font-bold">{{ result.currentTimeCaller }}</p>
            <p class="text-sm text-muted-foreground">{{ result.callerTimezone }}</p>
          </div>
          <div class="border rounded-lg p-4">
            <h3 class="font-semibold mb-2">Recipient Current Time</h3>
            <p class="text-2xl font-bold">{{ result.currentTimeRecipient }}</p>
            <p class="text-sm text-muted-foreground">{{ result.recipientTimezone }}</p>
          </div>
        </div>

        <!-- Recommended Windows -->
        <div v-if="result.recommendedWindows.length > 0">
          <h3 class="text-lg font-semibold mb-3">Recommended Calling Windows</h3>
          <div class="space-y-2">
            <div
              v-for="(window, index) in result.recommendedWindows"
              :key="index"
              class="border rounded-lg p-4"
            >
              <div class="flex justify-between items-center">
                <div>
                  <p class="font-semibold">{{ window.label }}</p>
                  <p class="text-sm text-muted-foreground">
                    {{ window.start }} - {{ window.end }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Working Hours Overlap -->
        <div v-if="result.workingHoursOverlap.hasOverlap">
          <h3 class="text-lg font-semibold mb-3">Working Hours Overlap</h3>
          <div class="space-y-2">
            <div
              v-for="(hour, index) in result.workingHoursOverlap.hours"
              :key="index"
              class="border rounded-lg p-3"
            >
              <p class="text-sm">
                <span class="font-semibold">{{ hour.start }}</span> -
                <span class="font-semibold">{{ hour.end }}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="bg-primary/10 border border-primary rounded-lg p-6 text-center">
      <h3 class="text-xl font-semibold mb-2">
        Schedule your calls automatically with YourAppName
      </h3>
      <p class="text-muted-foreground mb-4">
        Never miss the best time to call - automate your international calling schedule
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
