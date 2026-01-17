<script setup lang="ts">
import { parsePhoneNumber, getCountries, type CountryCode } from "libphonenumber-js";
import { z } from "zod";

interface PhoneCheckResult {
  valid: boolean;
  country: string;
  carrier?: string;
  lineType?: string;
  e164: string;
  nationalFormat: string;
  internationalFormat: string;
}

const phoneNumber = ref("");
const selectedCountry = ref<string>("");
const isChecking = ref(false);
const result = ref<PhoneCheckResult | null>(null);
const error = ref<string | null>(null);

const countries = getCountries();

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Phone Number Checker - Free Online Tool",
  applicationCategory: "UtilityApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Free phone number checker tool to validate phone numbers, check carrier, line type, and format",
  url: "https://yourdomain.com/tools/phone-number-checker",
};

const checkPhoneNumber = async () => {
  if (!phoneNumber.value.trim()) {
    error.value = "Please enter a phone number";
    return;
  }

  isChecking.value = true;
  error.value = null;
  result.value = null;

  try {
    const response = await $fetch<PhoneCheckResult>("/api/tools/phone-number-checker", {
      method: "POST",
      body: {
        phoneNumber: phoneNumber.value,
        country: selectedCountry.value || undefined,
      },
    });
    result.value = response;
  } catch (err) {
    if (err instanceof Error) {
      error.value = err.message;
      return;
    }
    error.value = "An error occurred while checking the phone number";
  } finally {
    isChecking.value = false;
  }
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
  }
};
</script>

<template>
  <ToolLayout
    title="Phone Number Checker"
    description="Validate phone numbers instantly. Check carrier, line type, and format. Free tool - no signup required."
    :structured-data="structuredData"
  >
    <!-- Tool Form -->
    <div class="bg-card border rounded-lg p-6 mb-8">
      <form @submit.prevent="checkPhoneNumber" class="space-y-4">
        <div>
          <label for="phoneNumber" class="block text-sm font-medium mb-2">
            Phone Number
          </label>
          <input
            id="phoneNumber"
            v-model="phoneNumber"
            type="text"
            placeholder="+1234567890 or (123) 456-7890"
            class="w-full px-4 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label for="country" class="block text-sm font-medium mb-2">
            Country (Optional)
          </label>
          <select
            id="country"
            v-model="selectedCountry"
            class="w-full px-4 py-2 border rounded-md"
          >
            <option value="">Auto-detect</option>
            <option v-for="country in countries" :key="country" :value="country">
              {{ country }}
            </option>
          </select>
        </div>

        <button
          type="submit"
          :disabled="isChecking"
          class="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {{ isChecking ? "Checking..." : "Check Number" }}
        </button>
      </form>

      <div v-if="error" class="mt-4 p-4 bg-destructive/10 text-destructive rounded-md">
        {{ error }}
      </div>
    </div>

    <!-- Results -->
    <div v-if="result" class="bg-card border rounded-lg p-6 mb-8">
      <h2 class="text-2xl font-semibold mb-4">Results</h2>

      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <span class="font-semibold">Valid:</span>
          <span
            :class="result.valid ? 'text-green-600' : 'text-red-600'"
            class="font-medium"
          >
            {{ result.valid ? "Yes" : "No" }}
          </span>
        </div>

        <div>
          <span class="font-semibold">Country:</span>
          <span class="ml-2">{{ result.country }}</span>
        </div>

        <div>
          <span class="font-semibold">E.164 Format:</span>
          <div class="flex items-center gap-2 mt-1">
            <code class="bg-muted px-2 py-1 rounded">{{ result.e164 }}</code>
            <button
              @click="copyToClipboard(result.e164)"
              class="text-sm text-primary hover:underline"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <span class="font-semibold">National Format:</span>
          <div class="flex items-center gap-2 mt-1">
            <code class="bg-muted px-2 py-1 rounded">{{ result.nationalFormat }}</code>
            <button
              @click="copyToClipboard(result.nationalFormat)"
              class="text-sm text-primary hover:underline"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <span class="font-semibold">International Format:</span>
          <div class="flex items-center gap-2 mt-1">
            <code class="bg-muted px-2 py-1 rounded">{{ result.internationalFormat }}</code>
            <button
              @click="copyToClipboard(result.internationalFormat)"
              class="text-sm text-primary hover:underline"
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="bg-primary/10 border border-primary rounded-lg p-6 text-center">
      <h3 class="text-xl font-semibold mb-2">Call this number instantly using YourAppName</h3>
      <p class="text-muted-foreground mb-4">
        Start making calls with our professional calling platform
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
