<script setup lang="ts">
import { ref } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

const emit = defineEmits(['next', 'prev']);
const queryClient = useQueryClient();

const selectedDatabase = ref<string | null>(null);
const newDatabaseName = ref('');

// Fetch existing Notion databases
const { data: databases, isLoading: isDatabasesLoading, error: databasesError } = useQuery({
  queryKey: ['notionDatabases'],
  queryFn: () => $fetch('/api/notion/databases'),
});

// Mutation to create a new Notion database
const createDatabaseMutation = useMutation({
  mutationFn: async (name: string) => {
    return $fetch('/api/notion/databases', {
      method: 'POST',
      body: { name },
    });
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['notionDatabases'] });
    selectedDatabase.value = data.id; // Select the newly created database
    // Optionally, move to the next step here if creation implies completion of this step
    // emit('next');
  },
  onError: (error) => {
    console.error('Error creating database:', error);
    alert('Failed to create database. Please try again.');
  },
});

// Handle selection of an existing database
const handleDatabaseSelection = (dbId: string) => {
  selectedDatabase.value = dbId;
  // Optionally, move to the next step here if selection implies completion of this step
  // emit('next');
};

// Handle creation of a new database
const handleCreateDatabase = () => {
  if (newDatabaseName.value.trim()) {
    createDatabaseMutation.mutate(newDatabaseName.value.trim());
  } else {
    alert('Please enter a name for the new database.');
  }
};

const proceedToNextStep = () => {
  if (selectedDatabase.value) {
    emit('next');
  } else {
    alert('Please select an existing database or create a new one.');
  }
};
</script>

<template>
  <div>
    <h2>Step 3: Create or Select Notion Database</h2>
    <p>Choose an existing Notion database or create a new one to sync your QuickBooks data.</p>

    <div v-if="isDatabasesLoading">Loading databases...</div>
    <div v-else-if="databasesError">Error: {{ databasesError.message }}</div>
    <div v-else>
      <Select v-model="selectedDatabase" @update:modelValue="handleDatabaseSelection">
        <SelectTrigger>
          <SelectValue :placeholder="selectedDatabase ? 'Selected: ' + databases?.find(db => db.id === selectedDatabase)?.title[0]?.plain_text : 'Select an existing database'" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Existing Databases</SelectLabel>
            <SelectItem v-for="db in databases" :key="db.id" :value="db.id">
              {{ db.title[0]?.plain_text || 'Untitled Database' }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>

    <div class="mt-4">
      <Input v-model="newDatabaseName" placeholder="Or enter a name for a new database" />
      <Button @click="handleCreateDatabase" :disabled="createDatabaseMutation.isPending" class="mt-2">
        {{ createDatabaseMutation.isPending ? 'Creating...' : 'Create New Database' }}
      </Button>
    </div>

    <div class="mt-4">
      <Button @click="proceedToNextStep" :disabled="!selectedDatabase">Proceed</Button>
    </div>
  </div>
</template>