<script setup lang="ts">
import { useGoogleSheetsAuth } from "~~/composables/useGoogleSheetsAuth";

const { handleCallback } = useGoogleSheetsAuth();
const route = useRoute();
const isLoading = ref(true);

onMounted(async () => {
  const code = route.query.code as string;
  const state = route.query.state as string;

  if (!code) {
    console.log("no code");
    isLoading.value = false;
    return;
  }

  if (!state) {
    console.log("no state");
    isLoading.value = false;
    return;
  }

  try {
    await handleCallback({
      code,
    });

    if (state === "google-sheets") {
      //TODO: take the route from the automation types to route map
      await navigateTo("/app/services/connect/google-sheets");
    }
  } catch (error) {
    console.error("Error handling Notion callback:", error);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center min-h-screen">
    <div
      class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-primary"
    ></div>
  </div>
</template>
