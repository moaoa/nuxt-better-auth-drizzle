<script setup lang="ts">
import { useNotionAuth } from "~~/composables/useNotionAuth";

const { handleCallback } = useNotionAuth();
const route = useRoute();
const router = useRouter();
const isLoading = ref(true);

// Handle the callback on client side only to avoid hydration issues
onMounted(async () => {
  const code = route.query.code as string;
  let state = route.query.state as string | undefined;

  // Handle the case where state is the string "undefined"
  if (state === "undefined" || state === undefined || !state) {
    state = undefined;
  }

  if (!code) {
    console.log("No authorization code provided");
    isLoading.value = false;
    // Redirect to services page if no code
    await router.push("/app/services");
    return;
  }

  try {
    await handleCallback({
      code,
    });

    // Determine redirect based on state
    if (state === "google-sheets") {
      await router.push("/app/services/connect/google-sheets");
    } else {
      // Default redirect after successful Notion connection
      await router.push("/app/services");
    }
  } catch (error) {
    console.error("Error handling Notion callback:", error);
    // Redirect to services page even on error
    await router.push("/app/services");
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
