<script setup lang="ts">
import Stepper from "@/components/stepper/Stepper.vue";
import NotionConnectStep from "@/components/stepper/NotionConnectStep.vue";
import GoogleSheetsConnectStep from "@/components/stepper/GoogleSheetsConnectStep.vue";
import ChooseDirectionStep from "~/components/stepper/ChooseDirectionStep.vue";

defineProps<{
  steps: Array<{ name: string; component: any }>;
  currentStepIndex: number;
  notionAccountsOptions: { title: string; id: string }[];
  googleSheetsAccountsOptions: { title: string; id: string }[];
}>();

const emit = defineEmits<{
  prev: [];
  next: [];
  "database-selected": [dbId: string];
}>();
</script>

<template>
  <Stepper
    :steps="steps"
    :current-step-index="currentStepIndex"
    @prev="emit('prev')"
    @next="emit('next')"
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
      <ChooseDirectionStep @database-selected="emit('database-selected', $event)" />
    </template>
  </Stepper>
</template>

