<script lang="ts" setup>
import { useQuery, useQueryClient } from "@tanstack/vue-query";

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();

const paymentId = computed(() => route.query.payment_id as string | undefined);

interface PaymentStatusResponse {
  paymentId: number;
  status: string;
  completedAt: string | null;
  amountUsd: number;
}

const {
  data: paymentStatus,
  isLoading: paymentStatusLoading,
  isError: paymentStatusError,
} = useQuery<PaymentStatusResponse>({
  queryKey: computed(() => ["nowpayments-payment-status", paymentId.value]),
  enabled: computed(() => Boolean(paymentId.value)),
  queryFn: () =>
    $fetch("/api/nowpayments/payment-status", {
      params: { paymentId: paymentId.value },
    }),
  refetchInterval: (query) => {
    const currentStatus = query.state.data?.status;
    return currentStatus === "finished" ? false : 3000;
  },
});

// Fetch wallet balance to show updated amount
const { data: wallet, refetch: refetchWallet } = useQuery({
  queryKey: ["wallet"],
  queryFn: async () => {
    const response = await $fetch("/api/wallet");
    return response;
  },
});

const paymentFinished = computed(() => paymentStatus.value?.status === "finished");

onMounted(async () => {
  if (!paymentId.value) {
    console.error("No payment ID provided");
    return;
  }

  try {
    await queryClient.invalidateQueries({ queryKey: ["wallet"] });
    if (paymentFinished.value) {
      await refetchWallet();
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
  }
});

watch(paymentFinished, async (finished) => {
  if (!finished) return;
  await queryClient.invalidateQueries({ queryKey: ["wallet"] });
  await refetchWallet();
});

const goToWallet = () => {
  router.push("/app/wallet");
};
</script>

<template>
  <main class="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
    <div class="mx-auto w-full max-w-2xl">
      <div class="p-8 bg-card rounded-lg border text-center">
        <div class="mb-6">
          <div
            class="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            :class="paymentFinished ? 'bg-green-100 dark:bg-green-900' : 'bg-yellow-100 dark:bg-yellow-900'"
          >
            <Icon
              :name="paymentFinished ? 'lucide:check' : 'lucide:clock-3'"
              class="w-8 h-8"
              :class="paymentFinished ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'"
            />
          </div>
          <h1 class="text-3xl font-bold mb-2">
            {{ paymentFinished ? "Payment Successful!" : "Payment Pending" }}
          </h1>
          <p class="text-muted-foreground">
            {{
              paymentFinished
                ? "Funds have been added to your wallet."
                : "We're waiting for NOWPayments confirmation. This page updates automatically."
            }}
          </p>
        </div>

        <div v-if="paymentStatusLoading" class="mb-6 p-4 bg-muted rounded-lg">
          <p class="text-sm text-muted-foreground">Checking payment status...</p>
        </div>

        <div v-else-if="paymentStatusError" class="mb-6 p-4 bg-muted rounded-lg">
          <p class="text-sm text-destructive">
            We could not verify your payment status yet. Please refresh in a moment.
          </p>
        </div>

        <div v-else-if="wallet" class="mb-6 p-4 bg-muted rounded-lg">
          <p class="text-sm text-muted-foreground mb-1">New Balance</p>
          <p class="text-2xl font-bold">
            ${{ wallet.balanceUsd?.toFixed(2) || "0.00" }}
          </p>
        </div>

        <div class="flex gap-4 justify-center">
          <UiButton @click="goToWallet" size="lg">
            <Icon name="lucide:wallet" class="mr-2" />
            Go to Wallet
          </UiButton>
          <UiButton variant="outline" @click="() => router.push('/app/dialer')" size="lg">
            <Icon name="lucide:phone" class="mr-2" />
            Make a Call
          </UiButton>
        </div>

        <p v-if="paymentId" class="text-xs text-muted-foreground mt-6">
          Payment ID: {{ paymentId }}
        </p>
      </div>
    </div>
  </main>
</template>
