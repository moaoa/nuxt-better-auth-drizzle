<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { useNotionAuth } from "~~/composables/useNotionAuth";
import { useStepper } from "~~/composables/useStepper";

const props = defineProps<{
  notionAccountsOptions: { title: string; id: string }[];
}>();

const { initiateAuth } = useNotionAuth();
const { setNotionAccount, nextStep } = useStepper();

const selectedAccount = ref<string | null>(null);

const handleConnect = () => {
  initiateAuth("notion");
};

const handleNext = () => {
  if (selectedAccount.value) {
    setNotionAccount(selectedAccount.value);
    nextStep();
  }
};
</script>

<template>
  <div>
    <h2>Step 1: Connect with Notion</h2>
    <div v-if="notionAccountsOptions.length > 0">
      <p>Select a Notion account:</p>
      <div v-for="account in notionAccountsOptions" :key="account.id">
        <input
          type="radio"
          :id="account.id"
          :value="account.id"
          v-model="selectedAccount"
        />
        <label :for="account.id">{{ account.title }}</label>
      </div>
      <Button @click="handleNext" :disabled="!selectedAccount"> Next </Button>
    </div>
    <div v-else>
      <p>Click the button below to connect your Notion account.</p>
      <Button @click="handleConnect"> Connect to Notion </Button>
    </div>
  </div>
</template>
