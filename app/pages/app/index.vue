<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">Dashboard</h1>

    <div class="space-y-6"></div>
  </div>
</template>

<script setup lang="ts">
import { useNotionAuth } from "~~/composables/useNotionAuth";
import { useWorkspaces } from "~~/composables/useWorkspaces";

const { initiateAuth } = useNotionAuth();
const { workspaces, loading, error } = useWorkspaces();

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const initiateNotionAuth = () => {
  initiateAuth();
};
</script>
