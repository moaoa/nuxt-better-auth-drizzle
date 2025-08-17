import { useAppSelector } from "~~/composables/store";
import { trpc } from "~~/utils/trpc";

export const useAutomations = () => {
  const automations = ref<trpc.automations.GetAutomations.Output[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const { currentUser } = useAppSelector((state) => state.auth);

  const fetchAutomations = async () => {
    loading.value = true;
    error.value = null;

    try {
      const data = await trpc.automations.getAutomations.fetch({
        userId: currentUser?.id ?? "",
      });

      automations.value = data;
    } catch (err) {
      error.value = err as Error;
    } finally {
      loading.value = false;
    }
  };

  return {
    automations,
    loading,
    error,
    fetchAutomations,
  };
};
