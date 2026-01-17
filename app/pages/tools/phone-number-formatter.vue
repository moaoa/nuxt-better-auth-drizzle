<script setup lang="ts">
import {
  parsePhoneNumber,
  formatIncompletePhoneNumber,
  getCountries,
  type CountryCode,
} from "libphonenumber-js";

interface FormatResult {
  e164: string;
  nationalFormat: string;
  internationalFormat: string;
  rfc3966: string;
  country: string;
  valid: boolean;
}

const phoneNumber = ref("");
const selectedCountry = ref<string>("");
const result = ref<FormatResult | null>(null);
const error = ref<string | null>(null);

const countries = getCountries();

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Phone Number Formatter - Free Tool",
  applicationCategory: "UtilityApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Format phone numbers into international, national, and E.164 formats. Clean and standardize phone numbers instantly.",
  url: "https://yourdomain.com/tools/phone-number-formatter",
};

const formatPhoneNumber = () => {
  if (!phoneNumber.value.trim()) {
    error.value = "Please enter a phone number";
    result.value = null;
    return;
  }

  error.value = null;

  try {
    const countryCode = selectedCountry.value
      ? (selectedCountry.value as CountryCode)
      : undefined;

    const parsed = parsePhoneNumber(phoneNumber.value, countryCode);

    if (!parsed) {
      error.value = "Invalid phone number format";
      result.value = null;
      return;
    }

    result.value = {
      e164: parsed.number || phoneNumber.value,
      nationalFormat: parsed.formatNational(),
      internationalFormat: parsed.formatInternational(),
      rfc3966: `tel:${parsed.number}`,
      country: parsed.country || "Unknown",
      valid: parsed.isValid(),
    };
  } catch (err) {
    if (err instanceof Error) {
      error.value = err.message;
      return;
    }
    error.value = "Failed to format phone number";
    result.value = null;
  }
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
  }
};

// Watch for changes and format in real-time
watch([phoneNumber, selectedCountry], () => {
  if (phoneNumber.value.trim()) {
    formatPhoneNumber();
  } else {
    result.value = null;
    error.value = null;
  }
});
</script>

<template>
  <ToolLayout
    title="Phone Number Formatter"
    description="Format phone numbers into international, national, and E.164 formats instantly. Clean and standardize phone numbers for databases, APIs, and contact lists. Free tool."
    :structured-data="structuredData"
  >
    <!-- Tool Form -->
    <div class="bg-card border rounded-lg p-6 mb-8">
      <div class="space-y-4">
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
      </div>

      <div v-if="error" class="mt-4 p-4 bg-destructive/10 text-destructive rounded-md">
        {{ error }}
      </div>
    </div>

    <!-- Results -->
    <div v-if="result" class="bg-card border rounded-lg p-6 mb-8">
      <h2 class="text-2xl font-semibold mb-4">Formatted Numbers</h2>

      <div class="space-y-4">
        <div>
          <span class="font-semibold block mb-2">E.164 Format:</span>
          <div class="flex items-center gap-2">
            <code class="flex-1 bg-muted px-3 py-2 rounded">{{ result.e164 }}</code>
            <button
              @click="copyToClipboard(result.e164)"
              class="text-sm text-primary hover:underline px-2"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <span class="font-semibold block mb-2">National Format:</span>
          <div class="flex items-center gap-2">
            <code class="flex-1 bg-muted px-3 py-2 rounded">{{ result.nationalFormat }}</code>
            <button
              @click="copyToClipboard(result.nationalFormat)"
              class="text-sm text-primary hover:underline px-2"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <span class="font-semibold block mb-2">International Format:</span>
          <div class="flex items-center gap-2">
            <code class="flex-1 bg-muted px-3 py-2 rounded">{{ result.internationalFormat }}</code>
            <button
              @click="copyToClipboard(result.internationalFormat)"
              class="text-sm text-primary hover:underline px-2"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <span class="font-semibold block mb-2">RFC3966 Format:</span>
          <div class="flex items-center gap-2">
            <code class="flex-1 bg-muted px-3 py-2 rounded">{{ result.rfc3966 }}</code>
            <button
              @click="copyToClipboard(result.rfc3966)"
              class="text-sm text-primary hover:underline px-2"
            >
              Copy
            </button>
          </div>
        </div>

        <div class="pt-4 border-t">
          <div class="flex items-center gap-2">
            <span class="font-semibold">Country:</span>
            <span>{{ result.country }}</span>
          </div>
          <div class="flex items-center gap-2 mt-2">
            <span class="font-semibold">Valid:</span>
            <span :class="result.valid ? 'text-green-600' : 'text-yellow-600'">
              {{ result.valid ? "Yes" : "Partial" }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="bg-primary/10 border border-primary rounded-lg p-6 text-center">
      <h3 class="text-xl font-semibold mb-2">
        Import formatted numbers directly into YourAppName
      </h3>
      <p class="text-muted-foreground mb-4">
        Format and import numbers directly to your CRM and calling platform
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
