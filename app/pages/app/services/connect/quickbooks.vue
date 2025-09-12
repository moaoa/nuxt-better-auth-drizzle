<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import Stepper from "@/components/stepper/Stepper.vue";
import NotionConnectStep from "@/components/stepper/NotionConnectStep.vue";
import QuickbooksConnectStep from "@/components/stepper/QuickbooksConnectStep.vue";
import NotionDatabaseStep from "@/components/stepper/NotionDatabaseStep.vue";
import { quickbooksRepository } from "~~/repositories/quickbooks";
import { useMutation, useQueryClient } from "@tanstack/vue-query";

const queryClient = useQueryClient();
const route = useRoute();

onMounted(() => {
  localStorage.setItem("selectedService", "quickbooks");
});

const steps = [
  { name: "Connect Notion", component: NotionConnectStep },
  { name: "Connect QuickBooks", component: QuickbooksConnectStep },
  { name: "Select Database", component: NotionDatabaseStep },
];

const currentStepIndex = ref(0);

const notionConnected = computed(() => {
  return route.query.state === "notion" && route.query.code;
});

const quickbooksConnected = computed(() => {
  return route.query.state === "quickbooks" && route.query.code;
});

const selectedDatabaseId = ref<string | null>(null);

const saveServiceMutation = useMutation({
  mutationFn: async (notion_db_id: string) => {
    return quickbooksRepository.saveService("quickbooks", notion_db_id);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["notionDatabases"] });
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

// Logic to advance stepper based on OAuth callbacks
if (notionConnected.value && currentStepIndex.value === 0) {
  currentStepIndex.value = 1;
}
if (quickbooksConnected.value && currentStepIndex.value === 1) {
  currentStepIndex.value = 2;
}
</script>

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">Connect to QuickBooks</h1>
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
        <QuickbooksConnectStep @next="onStepNext" />
      </template>
      <template #step-2>
        <NotionDatabaseStep @database-selected="onDatabaseSelected" />
      </template>
    </Stepper>
  </div>
</template>
