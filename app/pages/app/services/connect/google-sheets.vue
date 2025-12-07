<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import StepperClient from "@/components/stepper/StepperClient.vue";
import NotionConnectStep from "@/components/stepper/NotionConnectStep.vue";
import GoogleSheetsConnectStep from "@/components/stepper/GoogleSheetsConnectStep.vue";
import ChooseDirectionStep from "~/components/stepper/ChooseDirectionStep.vue";
import { useMutation } from "@tanstack/vue-query";
import { useStepper } from "~~/composables/useStepper";

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
    component: ChooseDirectionStep,
  },
];

const { currentStep, prevStep, nextStep, setStep } =
  useStepper("google-sheets");

// Ensure currentStep is within valid bounds
onMounted(() => {
  const maxStep = steps.length - 1;
  if (currentStep.value > maxStep) {
    setStep(maxStep, steps.length);
  }
});

// Watch for changes and ensure step stays within bounds
watch(currentStep, (newStep) => {
  const maxStep = steps.length - 1;
  if (newStep > maxStep) {
    setStep(maxStep, steps.length);
  } else if (newStep < 0) {
    setStep(0, steps.length);
  }
});

const handleNext = () => {
  nextStep(steps.length);
};

const handlePrev = () => {
  prevStep();
};

const { data: connections } = await useFetch("/api/connections");

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

const notionAccountsOptions = computed(() => {
  if (!connections.value?.data?.notionAccounts) {
    return [];
  }
  return connections.value.data.notionAccounts.map((account) => ({
    title: account.user_name,
    id: account.uuid,
  }));
});

const googleSheetsAccountsOptions = computed(() => {
  if (!connections.value?.data?.googleSheetsAccounts) {
    return [];
  }

  return connections.value.data.googleSheetsAccounts.map((account) => ({
    title: account.user_name,
    id: account.googleSheetsId,
  }));
});

const onDatabaseSelected = (dbId: string) => {
  selectedDatabaseId.value = dbId;
  saveServiceMutation.mutate(dbId);
};
</script>

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">Connect to Google Sheets</h1>
    <ClientOnly>
      <StepperClient
        :steps="steps"
        :current-step-index="Number(currentStep)"
        :notion-accounts-options="notionAccountsOptions"
        :google-sheets-accounts-options="googleSheetsAccountsOptions"
        @prev="handlePrev"
        @next="handleNext"
        @database-selected="onDatabaseSelected"
      />
      <template #fallback>
        <div class="stepper-container">
          <div class="flex items-center justify-center min-h-[200px]">
            <div class="text-muted-foreground">Loading stepper...</div>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
