<script setup lang="ts">
import { ref, onMounted } from "vue";
import Stepper from "@/components/stepper/Stepper.vue";
import NotionConnectStep from "@/components/stepper/NotionConnectStep.vue";
import GoogleSheetsConnectStep from "@/components/stepper/GoogleSheetsConnectStep.vue";
import NotionDatabaseStep from "@/components/stepper/NotionDatabaseStep.vue";
import { useMutation } from "@tanstack/vue-query";
import { useNotionAuth } from "~~/composables/useNotionAuth";
import { useGoogleSheetsAuth } from "~~/composables/useGoogleSheetsAuth";

const config = useRuntimeConfig();
const route = useRoute();
const { handleCallback: handleNotionCallback } = useNotionAuth();
const { handleCallback: handleGoogleSheetsCallback } = useGoogleSheetsAuth();

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

const isLoading = ref(false);

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

onMounted(async () => {
  const code = route.query.code as string;
  const state = route.query.state as string;

  if (!code) {
    console.log("no code");
    return;
  }

  if (!state) {
    console.log("no state");
    return;
  }

  try {
    isLoading.value = true;
    const connectedService = localStorage.getItem("connectedService");

    const isNotionConnected = connectedService === "notion";
    const isGoogleSheetsConnected = connectedService === "google-sheets";

    if (state === "notion") {
      console.log("notion");
      await handleNotionCallback({
        redirect_uri: config.public.NOTION_TO_GOOGLE_SHEETS_REDIRECT_URI,
        code,
      });
      currentStepIndex.value = 1;
      return;
    }

    if (state === "google-sheets") {
      console.log("google-sheets");
      await handleGoogleSheetsCallback({
        redirect_uri: config.public.NOTION_TO_GOOGLE_SHEETS_REDIRECT_URI,
        code,
      });
      currentStepIndex.value = 2;
      return;
    }
  } catch (error) {
    console.log(error);
  } finally {
    isLoading.value = false;
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
