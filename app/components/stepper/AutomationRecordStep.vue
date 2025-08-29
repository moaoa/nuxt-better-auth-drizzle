<script setup lang="ts">
import { useMutation } from '@tanstack/vue-query';
import { Button } from '@/components/ui/button';
import { quickbooksRepository } from '~~/repositories/quickbooks'; // Import the repository

const emit = defineEmits(['next', 'prev']);

// Mutation to create an automation record
const createAutomationMutation = useMutation({
  mutationFn: async (service_id: string) => { // Accept service_id as a parameter
    return quickbooksRepository.createAutomation(service_id); // Use the repository method
  },
  onSuccess: () => {
    emit('next');
  },
  onError: (error) => {
    console.error('Error creating automation record:', error);
    alert('Failed to create automation record. Please try again.');
  },
});

const createRecord = () => {
  // For now, hardcode a service_id. In a real scenario, this would come from a previous step.
  createAutomationMutation.mutate('some_service_uuid'); // Pass a placeholder service_id
};
</script>

<template>
  <div>
    <h2>Step 4: Create Automation Record</h2>
    <p>Click the button below to create the automation record.</p>
    <Button @click="createRecord" :disabled="createAutomationMutation.isPending">
      {{ createAutomationMutation.isPending ? 'Creating...' : 'Create Automation Record' }}
    </Button>
  </div>
</template>