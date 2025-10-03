<script setup lang="ts">
import { ref } from "vue";
import Stepper from "@/components/stepper/Stepper.vue";
import NotionConnectStep from "@/components/stepper/NotionConnectStep.vue";
import GoogleSheetsConnectStep from "@/components/stepper/GoogleSheetsConnectStep.vue";
import NotionDatabaseStep from "@/components/stepper/NotionDatabaseStep.vue";
import { useMutation } from "@tanstack/vue-query";

const config = useRuntimeConfig();

const steps = [
  {
    name: "Connect Notion",
    component: NotionConnectStep,
  },
  {
    name: "Connect Google Sheets",
    component: GoogleSheetsConnectStep,
  },
  {
    name: "Select Database",
    component: NotionDatabaseStep,
  },
];

const currentStepIndex = ref(0);
const maxStepIndex = ref(0);

const { data: connections } = await useFetch("/api/connections");

if (connections.value?.data) {
  const isNotionConnected = connections.value.data.notionAccounts.length > 0;
  const isGoogleSheetsConnected =
    connections.value.data.googleSheetsAccounts.length > 0;

  if (isNotionConnected) {
    currentStepIndex.value++;
    maxStepIndex.value++;
  }

  if (isGoogleSheetsConnected) {
    currentStepIndex.value++;
    maxStepIndex.value++;
  }
}

const selectedDatabaseId = ref<string | null>(null);

const saveServiceMutation = useMutation({
  mutationFn: async (notion_db_id: string) => {
    // TODO: Implement googleSheetsRepository.saveService
    // return googleSheetsRepository.saveService("google-sheets", notion_db_id);
  },
  onSuccess: () => {
    // queryClient.invalidateQueries({ queryKey: ["notionDatabases"] });
    // Optionally, you can move to a final "completed" step
  },
});

const onStepNext = () => {
  if (currentStepIndex.value === maxStepIndex.value) {
    return;
  }

  if (currentStepIndex.value < steps.length - 1) {
    currentStepIndex.value++;
  }
};

const onStepPrev = () => {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--;
  }
};

const onDatabaseSelected = (dbId: string) => {
  selectedDatabaseId.value = dbId;
  saveServiceMutation.mutate(dbId);
};
</script>

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">Connect to Google Sheets</h1>
    <Stepper
      :steps="steps"
      :current-step-index="currentStepIndex"
      @next="onStepNext"
      @prev="onStepPrev"
    >
      <template #step-0>
        <NotionConnectStep
          @next="onStepNext"
          :redirectUri="config.public.NOTION_TO_GOOGLE_SHEETS_REDIRECT_URI"
        />
      </template>
      <template #step-1>
        <GoogleSheetsConnectStep @next="onStepNext" />
      </template>
      <template #step-2>
        <NotionDatabaseStep @database-selected="onDatabaseSelected" />
      </template>
    </Stepper>
  </div>
</template>
