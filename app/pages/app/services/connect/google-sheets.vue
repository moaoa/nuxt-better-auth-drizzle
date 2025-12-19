<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import GoogleSheetsStepper from "@/components/stepper/GoogleSheetsStepper.vue";
import NotionConnectStep from "@/components/stepper/NotionConnectStep.vue";
import GoogleSheetsConnectStep from "@/components/stepper/GoogleSheetsConnectStep.vue";
import ChooseDirectionStep from "~/components/stepper/ChooseDirectionStep.vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { useStepper } from "~~/composables/useStepper";
import { useToast } from "@/components/ui/toast/use-toast";

const { toast } = useToast();
const queryClient = useQueryClient();

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

const { currentStep, prevStep, nextStep, selectedAccounts } = useStepper();

// Ensure currentStep is within valid bounds
onMounted(() => {
  const maxStep = steps.length - 1;
  if (currentStep.value > maxStep) {
    currentStep.value = maxStep;
  }
});

// Watch for changes and ensure step stays within bounds
watch(currentStep, (newStep) => {
  const maxStep = steps.length - 1;
  if (newStep > maxStep) {
    currentStep.value = maxStep;
  } else if (newStep < 0) {
    currentStep.value = 0;
  }
});

const handleNext = () => {
  const maxStep = steps.length - 1;
  if (currentStep.value < maxStep) {
    nextStep();
  }
};

const handlePrev = () => {
  prevStep();
};

const { data: connections } = await useFetch("/api/connections");

// State management for collected data
// Use stepper's stored state as source of truth, with local refs as fallback
const selectedNotionAccountId = computed(() => selectedAccounts.value.notion);
const selectedGoogleSheetsAccountId = computed(
  () => selectedAccounts.value.googleSheets
);
const selectedNotionEntityId = ref<string | null>(null);
const selectedGoogleSheetId = ref<string | null>(null);
const createNewGoogleSheet = ref(false);
const newGoogleSheetName = ref("");

// Handle account selections from stepper components
// Note: The child components already update the stepper state via setNotionAccount/setGoogleSheetsAccount
// These handlers are kept for event consistency, but the state is managed by the stepper composable
const onNotionAccountSelected = (accountId: string) => {
  console.log("Notion account selected event received:", accountId);
};

const onGoogleSheetsAccountSelected = (accountId: string) => {
  console.log("Google Sheets account selected event received:", accountId);
};

// Handle database selection from ChooseDirectionStep
const onDatabaseSelected = (data: {
  notionEntityId: string;
  googleSheetId?: string;
  createNewSheet?: boolean;
  newSheetName?: string;
}) => {
  selectedNotionEntityId.value = data.notionEntityId;
  if (data.createNewSheet) {
    createNewGoogleSheet.value = true;
    newGoogleSheetName.value = data.newSheetName || "";
    selectedGoogleSheetId.value = null;
  } else {
    createNewGoogleSheet.value = false;
    selectedGoogleSheetId.value = data.googleSheetId || null;
    newGoogleSheetName.value = "";
  }

  // Automatically save when database is selected
  saveServiceMutation.mutate();
};

const saveServiceMutation = useMutation({
  mutationFn: async () => {
    const notionAccountId = selectedNotionAccountId.value;
    const googleSheetsAccountId = selectedGoogleSheetsAccountId.value;
    const notionEntityId = selectedNotionEntityId.value;

    if (!notionAccountId || !googleSheetsAccountId || !notionEntityId) {
      console.log({
        selectedNotionAccountId: notionAccountId,
        selectedGoogleSheetsAccountId: googleSheetsAccountId,
        selectedNotionEntityId: notionEntityId,
        stepperAccounts: selectedAccounts.value,
      });
      throw new Error("Missing required selections");
    }

    if (!createNewGoogleSheet.value && !selectedGoogleSheetId.value) {
      throw new Error("Please select a Google Sheet or create a new one");
    }

    const payload = {
      type: "notion_db_to_google_sheet" as const,
      notionEntityId: notionEntityId,
      notionAccountId: notionAccountId,
      googleSheetsAccountId: googleSheetsAccountId,
      googleSheetId: selectedGoogleSheetId.value || "",
      config: {
        createNewGoogleSheet: createNewGoogleSheet.value,
        createNewNotionDb: false,
      },
    };

    const response = await $fetch("/api/automations", {
      method: "POST",
      body: payload,
    });

    return response;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["automations"] });
    toast({
      title: "Success",
      description: "Automation created successfully",
    });
    navigateTo("/app/automations");
  },
  onError: (error: any) => {
    console.error("Failed to create automation:", error);
    toast({
      title: "Error",
      description:
        error.data?.message || error.message || "Failed to create automation",
      variant: "destructive",
    });
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
</script>

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">Connect to Google Sheets</h1>
    <ClientOnly>
      <GoogleSheetsStepper
        :steps="steps"
        :current-step-index="Number(currentStep)"
        :notion-accounts-options="notionAccountsOptions"
        :google-sheets-accounts-options="googleSheetsAccountsOptions"
        @prev="handlePrev"
        @next="handleNext"
        @database-selected="onDatabaseSelected"
        @notion-account-selected="onNotionAccountSelected"
        @google-sheets-account-selected="onGoogleSheetsAccountSelected"
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
