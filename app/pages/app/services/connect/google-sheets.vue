<script setup lang="ts">
import { ref, computed } from "vue";
import Stepper from "@/components/stepper/Stepper.vue";
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

const { currentStep, prevStep, nextStep } = useStepper();

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
    <Stepper
      :steps="steps"
      :current-step-index="Number(currentStep)"
      @prev="prevStep"
      @next="nextStep"
    >
      <template #step-0>
        <NotionConnectStep :notion-accounts-options="notionAccountsOptions" />
      </template>
      <template #step-1>
        <GoogleSheetsConnectStep
          :google-sheets-accounts-options="googleSheetsAccountsOptions"
        />
      </template>
      <template #step-2>
        <ChooseDirectionStep @database-selected="onDatabaseSelected" />
      </template>
    </Stepper>
  </div>
</template>
