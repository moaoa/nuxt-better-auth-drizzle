<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Dashboard</h1>

    <div class="space-y-4">
      <div class="bg-white p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-4">Notion Integration</h2>
        <button
          @click="initiateNotionAuth"
          class="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
        >
          Connect Notion Workspace
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNotionAuth } from "~~/composables/useNotionAuth";

const { initiateAuth } = useNotionAuth();

const initiateNotionAuth = () => {
  initiateAuth();
};
</script>
