<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNotionAuth } from "~~/composables/useNotionAuth";
import { useStepper } from "~~/composables/useStepper";

defineProps<{
  notionAccountsOptions: { title: string; id: string }[];
}>();

const { initiateAuth } = useNotionAuth();
const { setNotionAccount, nextStep, selectedAccounts } = useStepper("google-sheets");

const selectedAccount = ref<string>("");
const CONNECT_NEW_VALUE = "__connect_new__";

// Watch for the special "connect new" option
watch(selectedAccount, (newValue) => {
  if (newValue === CONNECT_NEW_VALUE) {
    handleConnect();
    // Reset selection after initiating auth
    selectedAccount.value = "";
  }
});

const handleConnect = () => {
  initiateAuth("google-sheets");
};

const handleNext = () => {
  if (selectedAccount.value && selectedAccount.value !== CONNECT_NEW_VALUE) {
    setNotionAccount(selectedAccount.value);
    nextStep();
  }
};

const canProceed = () => {
  return selectedAccount.value && selectedAccount.value !== CONNECT_NEW_VALUE;
};

watch(
  selectedAccounts,
  (newValue) => {
    if (newValue.notion) {
      selectedAccount.value = newValue.notion;
    }
  },
  {
    immediate: true,
  }
);
</script>

<template>
  <div class="flex flex-col gap-6 max-w-md mx-auto p-6">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold tracking-tight">Connect with Notion</h2>
      <p class="text-sm text-muted-foreground">
        Select an existing account or connect a new one to continue
      </p>
    </div>

    <div class="space-y-4">
      <div class="space-y-2">
        <label
          class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Notion Account
        </label>
        <Select v-model="selectedAccount">
          <SelectTrigger class="w-full">
            <SelectValue placeholder="Choose an account or connect new..." />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Your Accounts</SelectLabel>
              <SelectItem
                v-for="account in notionAccountsOptions"
                :key="account.id"
                :value="account.id"
              >
                {{ account.title }}
              </SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Actions</SelectLabel>
              <SelectItem
                :value="CONNECT_NEW_VALUE"
                class="text-primary font-medium"
              >
                <div class="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                  </svg>
                  <span>Connect New Account</span>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Button
        @click="handleNext"
        :disabled="!canProceed()"
        class="w-full"
        size="lg"
      >
        Continue
      </Button>
    </div>

    <div class="text-center text-xs text-muted-foreground">
      <p>By connecting, you agree to grant access to your Notion workspace</p>
    </div>
  </div>
</template>
