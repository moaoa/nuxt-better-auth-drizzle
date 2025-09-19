<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import Stepper from "@/components/stepper/Stepper.vue";
import NotionConnectStep from "@/components/stepper/NotionConnectStep.vue";
import GoogleSheetsConnectStep from "@/components/stepper/GoogleSheetsConnectStep.vue";
import NotionDatabaseStep from "@/components/stepper/NotionDatabaseStep.vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { servicesRepo } from "~~/repositories/services";

const queryClient = useQueryClient();
const route = useRoute();

const { data: notionConnected } = useQuery({
  queryKey: ["services", "notion", "isConnected"],
  queryFn: async () => await servicesRepo.isConnected("notion"),
});

const { data: googleSheetsConnected } = useQuery({
  queryKey: ["services", "google_sheets", "isConnected"],
  queryFn: async () => await servicesRepo.isConnected("google_sheet"),
});

onMounted(() => {
  localStorage.setItem("selectedService", "google_sheets");
});

const steps = [
  { name: "Connect Notion", component: NotionConnectStep },
  { name: "Connect Google Sheets", component: GoogleSheetsConnectStep },
  { name: "Select Database", component: NotionDatabaseStep },
];

const currentStepIndex = ref(0);

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

watch([notionConnected, googleSheetsConnected], () => {
  if (googleSheetsConnected.value.connected) {
    currentStepIndex.value = 2;
  }

  if (notionConnected.value.connected) {
    currentStepIndex.value = 1;
  }
});
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
        <NotionConnectStep @next="onStepNext" />
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
