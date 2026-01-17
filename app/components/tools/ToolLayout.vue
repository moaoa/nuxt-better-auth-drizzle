<script setup lang="ts">
interface Props {
  title: string;
  description: string;
  structuredData?: Record<string, unknown>;
}

const props = defineProps<Props>();

// Set SEO meta tags
useSeoMeta({
  title: `${props.title} - Free Online Tool | YourAppName`,
  description: props.description,
  ogTitle: `${props.title} - Free Tool`,
  ogDescription: props.description,
  twitterCard: "summary_large_image",
});

// Add structured data if provided
if (props.structuredData) {
  useHead({
    script: [
      {
        type: "application/ld+json",
        children: JSON.stringify(props.structuredData),
      },
    ],
  });
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <div class="container mx-auto px-4 py-8 max-w-4xl">
      <!-- Hero Section -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold mb-4">{{ title }}</h1>
        <p class="text-lg text-muted-foreground">{{ description }}</p>
      </div>

      <!-- Tool Content -->
      <slot />

      <!-- Related Tools Section -->
      <div class="mt-12 pt-8 border-t">
        <h2 class="text-2xl font-semibold mb-4">Related Tools</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NuxtLink
            to="/tools/phone-number-checker"
            class="p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <h3 class="font-semibold">Phone Number Checker</h3>
            <p class="text-sm text-muted-foreground">Validate phone numbers instantly</p>
          </NuxtLink>
          <NuxtLink
            to="/tools/international-call-cost-calculator"
            class="p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <h3 class="font-semibold">International Call Cost Calculator</h3>
            <p class="text-sm text-muted-foreground">Calculate calling costs</p>
          </NuxtLink>
          <NuxtLink
            to="/tools/best-time-to-call-internationally"
            class="p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <h3 class="font-semibold">Best Time to Call Internationally</h3>
            <p class="text-sm text-muted-foreground">Find optimal calling times</p>
          </NuxtLink>
          <NuxtLink
            to="/tools/phone-number-formatter"
            class="p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <h3 class="font-semibold">Phone Number Formatter</h3>
            <p class="text-sm text-muted-foreground">Format phone numbers</p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
