<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { useGoogleSheetsAuth } from "~~/composables/useGoogleSheetsAuth";
import { useStepper } from "~~/composables/useStepper";

const { initiateAuth } = useGoogleSheetsAuth();
const { setGoogleSheetsAccount, nextStep } = useStepper();

const handleConnect = () => {
  initiateAuth("google-sheets");
  // TODO: Get the actual account ID after successful authentication
  const placeholderAccountId = `gsheets_${Math.random().toString(36).substring(7)}`;
  setGoogleSheetsAccount(placeholderAccountId);
  nextStep();
};
</script>

<template>
  <div>
    <h2>Step 2: Connect with Google Sheets</h2>
    <p>Click the button below to connect your Google Sheets account.</p>
    <Button @click="handleConnect"> Connect to Google Sheets </Button>
  </div>
</template>
