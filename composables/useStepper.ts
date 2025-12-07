import { useStorage } from "@vueuse/core";

export const useStepper = (serviceKey?: string) => {
  const storageKey = serviceKey
    ? `stepper-current-step-${serviceKey}`
    : "stepper-current-step";
  const currentStep = useStorage(storageKey, 0);

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

  const nextStep = (maxSteps?: number) => {
    if (maxSteps !== undefined && currentStep.value >= maxSteps - 1) {
      return;
    }
    currentStep.value++;
  };

  const prevStep = () => {
    if (currentStep.value > 0) {
      currentStep.value--;
    }
  };

  const resetStep = () => {
    currentStep.value = 0;
  };

  const setStep = (step: number, maxSteps?: number) => {
    if (maxSteps !== undefined) {
      currentStep.value = Math.max(0, Math.min(step, maxSteps - 1));
    } else {
      currentStep.value = Math.max(0, step);
    }
  };

  return {
    currentStep,
    selectedAccounts,
    setNotionAccount,
    setGoogleSheetsAccount,
    nextStep,
    prevStep,
    resetStep,
    setStep,
  };
};
