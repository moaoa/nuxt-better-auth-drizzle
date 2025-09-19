<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { useGoogleSheetsAuth } from "~~/composables/useGoogleSheetsAuth";

const emit = defineEmits(["next"]);

const { initiateAuth } = useGoogleSheetsAuth();
</script>

<template>
  <div>
    <h2>Step 2: Connect with Google Sheets</h2>
    <p>Click the button below to connect your Google Sheets account.</p>
    <Button @click="initiateAuth">Connect to Google Sheets</Button>
  </div>
</template>
