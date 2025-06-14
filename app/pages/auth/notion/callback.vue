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
    const response = await handleCallback(code);
    token.value = response.access_token;
  } catch (e) {
    error.value = "Failed to exchange code for token";
    console.error(e);
  } finally {
    loading.value = false;
  }
});
</script>
