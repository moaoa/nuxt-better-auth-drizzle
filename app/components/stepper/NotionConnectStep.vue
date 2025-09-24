<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { useNotionAuth } from "~~/composables/useNotionAuth";

const emit = defineEmits(["next"]);

const { redirectUri } = defineProps<{ redirectUri: string }>();

const { initiateAuth } = useNotionAuth();
</script>

<template>
  <div>
    <h2>Step 1: Connect with Notion</h2>
    <p>Click the button below to connect your Notion account.</p>
    <Button @click="() => initiateAuth(redirectUri)">Connect to Notion</Button>
  </div>
</template>
