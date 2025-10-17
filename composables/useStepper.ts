import { useStorage } from "@vueuse/core";

export const useStepper = () => {
  const currentStep = useStorage("stepper-current-step", 0);
  const selectedAccounts = useStorage<{
    notion: string | null;
    googleSheets: string | null;
  }>("stepper-selected-accounts", {
    notion: null,
    googleSheets: null,
  });

  const setNotionAccount = (accountId: string) => {
    selectedAccounts.value.notion = accountId;
  };

  const setGoogleSheetsAccount = (accountId: string) => {
    selectedAccounts.value.googleSheets = accountId;
  };

  const nextStep = () => {
    currentStep.value++;
  };

  const prevStep = () => {
    if (currentStep.value > 0) {
      currentStep.value--;
    }
  };

  return {
    currentStep,
    selectedAccounts,
    setNotionAccount,
    setGoogleSheetsAccount,
    nextStep,
    prevStep,
  };
};
