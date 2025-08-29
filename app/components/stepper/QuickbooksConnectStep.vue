<script setup lang="ts">
import { Button } from '@/components/ui/button';

const emit = defineEmits(['next']);

const connectQuickbooks = () => {
  // Redirect to the backend endpoint that initiates QuickBooks OAuth
  window.location.href = '/api/auth/quickbooks/connect';
};
</script>

<template>
  <div>
    <h2>Step 2: Connect with QuickBooks</h2>
    <p>Click the button below to connect your QuickBooks account.</p>
    <Button @click="connectQuickbooks">Connect to QuickBooks</Button>
    <p class="mt-4">
      After connecting, you will be redirected back to this application.
      Please click "Next" to proceed once connected.
    </p>
  </div>
</template>