<script setup lang="ts">
import Stepper from "@/components/stepper/Stepper.vue";
import NotionConnectStep from "@/components/stepper/NotionConnectStep.vue";
import GoogleSheetsConnectStep from "@/components/stepper/GoogleSheetsConnectStep.vue";
import ChooseDirectionStep from "~/components/stepper/ChooseDirectionStep.vue";
import SelectColumnsStep from "~/components/stepper/SelectColumnsStep.vue";

const props = defineProps<{
  steps: Array<{ name: string; component: any }>;
  currentStepIndex: number;
  notionAccountsOptions: { title: string; id: string }[];
  googleSheetsAccountsOptions: { title: string; id: string }[];
  selectedNotionEntityId?: string | null;
}>();

const emit = defineEmits<{
  prev: [];
  next: [];
  "database-selected": [data: {
    notionEntityId: string;
    googleSheetId?: string;
    createNewSheet?: boolean;
    newSheetName?: string;
  }];
  "columns-selected": [columns: Array<{ id: string; name: string; type: string }>];
  "notion-account-selected": [accountId: string];
  "google-sheets-account-selected": [accountId: string];
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
      <NotionConnectStep
        :notion-accounts-options="notionAccountsOptions"
        @account-selected="emit('notion-account-selected', $event)"
      />
    </template>
    <template #step-1>
      <GoogleSheetsConnectStep
        :google-sheets-accounts-options="googleSheetsAccountsOptions"
        @account-selected="emit('google-sheets-account-selected', $event)"
      />
    </template>
    <template #step-2>
      <ChooseDirectionStep @database-selected="emit('database-selected', $event)" />
    </template>
    <template #step-3>
      <SelectColumnsStep
        :database-uuid="props.selectedNotionEntityId"
        @columns-selected="emit('columns-selected', $event)"
        @next="emit('next')"
        @prev="emit('prev')"
      />
    </template>
  </Stepper>
</template>

