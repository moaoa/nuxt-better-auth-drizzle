<script setup lang="ts">
import { useMutation } from '@tanstack/vue-query';
import { Button } from '@/components/ui/button';
import { quickbooksRepository } from '~~/repositories/quickbooks'; // Import the repository

const emit = defineEmits(['next', 'prev']);

// Mutation to create a connection record
const createConnectionMutation = useMutation({
  mutationFn: async (payload: { service_id: string; user_name: string }) => {
    return quickbooksRepository.createConnection(payload.service_id, payload.user_name);
  },
  onSuccess: () => {
    emit('next');
  },
  onError: (error) => {
    console.error('Error creating connection record:', error);
    alert('Failed to create connection record. Please try again.');
  },
});

const createRecord = () => {
  // For now, hardcode service_id and user_name.
  // In a real scenario, these would come from previous steps or user session.
  createConnectionMutation.mutate({ service_id: 'some_service_uuid', user_name: 'Current User' });
};
</script>

<template>
  <div>
    <h2>Step 5: Create Connection Record</h2>
    <p>Click the button below to create the connection record.</p>
    <Button @click="createRecord" :disabled="createConnectionMutation.isPending">
      {{ createConnectionMutation.isPending ? 'Creating...' : 'Create Connection Record' }}
    </Button>
  </div>
</template>