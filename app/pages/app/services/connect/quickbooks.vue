<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { quickbooksRepository } from "~~/repositories/quickbooks";
import { useQuickbooksAuth } from "~~/composables/useQuickbooksAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const queryClient = useQueryClient();

const { code, state } = useRoute().query;
const selectedDatabaseId = ref<string>();
const newDatabaseName = ref("");

const notionAuthSuccess = computed(() => {
  return typeof code === "string" && state === "notion";
});

const quickbooksAuthSuccess = computed(() => {
  return typeof code === "string" && state === "quickbooks";
});

const {
  data: databases,
  isLoading: isDatabasesLoading,
  error: databasesError,
} = useQuery({
  queryKey: ["notionDatabases"],
  queryFn: quickbooksRepository.getDatabases,
  enabled: quickbooksAuthSuccess,
});

const saveServiceMutation = useMutation({
  mutationFn: async (notion_db_id: string) => {
    const data = await quickbooksRepository.saveService(
      "quickbooks",
      notion_db_id
    );
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["notionDatabases"] });
  },
});

const createDatabaseMutation = useMutation({
  mutationFn: async (name: string) => {
    const data = await quickbooksRepository.createDatabase(name);
    return data;
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ["notionDatabases"] });
    selectedDatabaseId.value = data.id;
    saveServiceMutation.mutate(data.id);
  },
});

const handleDatabaseSelection = async (dbId: string) => {
  saveServiceMutation.mutate(dbId);
};

const handleCreateDatabase = async () => {
  createDatabaseMutation.mutate(newDatabaseName.value);
};

const initiateQuickbooksAuth = async () => {
  const { initiateAuth } = useQuickbooksAuth();
  initiateAuth();
};
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full">
    <div class="w-full max-w-md">
      <div>
        <UiButton
          @click="initiateQuickbooksAuth"
          :disabled="quickbooksAuthSuccess"
        >
          {{ quickbooksAuthSuccess ? "Connected" : "Connect to QuickBooks" }}
        </UiButton>
      </div>
      <div>
        <div v-if="isDatabasesLoading">Loading databases...</div>
        <div v-else-if="databasesError">
          Error: {{ databasesError.message }}
        </div>
        <Select
          v-else
          v-model="selectedDatabaseId"
          @update:modelValue="handleDatabaseSelection"
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a database" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Databases</SelectLabel>
              <SelectItem v-for="db in databases" :key="db.id" :value="db.id">
                {{ db.id }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <div class="mt-4">
          <UiInput v-model="newDatabaseName" placeholder="New database name" />
          <UiButton @click="handleCreateDatabase" class="mt-2">
            Create New Database
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>
