<template>
  <div class="container mx-auto p-4">
    <div v-if="error" class="text-red-500">
      {{ error }}
    </div>
    <div v-else-if="loading" class="text-gray-500">Loading...</div>
    <div v-else-if="token" class="space-y-4">
      <h1 class="text-2xl font-bold">Notion Integration Successful!</h1>
      <div class="bg-gray-100 p-4 rounded">
        <p class="font-mono break-all">{{ token }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNotionAuth } from "~~/composables/useNotionAuth";
import { useRouter } from "vue-router";
import { serviceKeyRouteMap } from "~~/lib/utils";

const router = useRouter();
const route = useRoute();
const { handleCallback } = useNotionAuth();

const loading = ref(true);
const error = ref<string | null>(null);
const token = ref<string | null>(null);

onMounted(async () => {
  const code = route.query.code as string;

  if (!code) {
    error.value = "No authorization code provided";
    loading.value = false;
    return;
  }

  try {
    await handleCallback(code);
    const selectedService = localStorage.getItem("selectedService");
    type Key = keyof typeof serviceKeyRouteMap;
    if (selectedService && serviceKeyRouteMap[selectedService as Key]) {
      const redirectRoute = serviceKeyRouteMap[selectedService as Key];
      localStorage.removeItem("selectedService");
      router.push(redirectRoute);
    } else {
      router.push("/app/services");
    }
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : "Failed to exchange code for token";
    console.error(e);
  } finally {
    loading.value = false;
  }
});
</script>
