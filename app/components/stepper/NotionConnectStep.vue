<script setup lang="ts">
import { Button } from '@/components/ui/button';

const emit = defineEmits(['next']);

const connectNotion = () => {
  // Redirect to the backend endpoint that initiates Notion OAuth
  window.location.href = '/api/auth/notion/connect';
};
</script>

<template>
  <div>
    <h2>Step 1: Connect with Notion</h2>
    <p>Click the button below to connect your Notion account.</p>
    <Button @click="connectNotion">Connect to Notion</Button>
    <p class="mt-4">
      After connecting, you will be redirected back to this application.
      Please click "Next" to proceed once connected.
    </p>
  </div>
</template>