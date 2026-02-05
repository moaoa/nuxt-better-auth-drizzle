<script lang="ts" setup>
import { useQuery } from "@tanstack/vue-query";

const route = useRoute();
const router = useRouter();

const sessionId = route.query.session_id as string;

// Fetch wallet balance to show updated amount
const { data: wallet, refetch: refetchWallet } = useQuery({
  queryKey: ["wallet"],
  queryFn: async () => {
    const response = await $fetch("/api/wallet");
    return response;
  },
});

// Verify payment on mount
const paymentVerified = ref(false);
const creditsAdded = ref<number | null>(null);

onMounted(async () => {
  if (!sessionId) {
    console.error("No session ID provided");
    return;
  }

  try {
    // Verify the session (this would ideally be done server-side)
    // For now, we'll just invalidate the wallet cache
    await refetchWallet();
    paymentVerified.value = true;

    // Extract credits from URL or wait for webhook
    // In a real scenario, you might want to fetch payment details
  } catch (error) {
    console.error("Error verifying payment:", error);
  }
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
          <div class="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
            <Icon name="lucide:check" class="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 class="text-3xl font-bold mb-2">Payment Successful!</h1>
          <p class="text-muted-foreground">
            Funds have been added to your wallet.
          </p>
        </div>

        <div v-if="wallet" class="mb-6 p-4 bg-muted rounded-lg">
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

        <p v-if="sessionId" class="text-xs text-muted-foreground mt-6">
          Session ID: {{ sessionId }}
        </p>
      </div>
    </div>
  </main>
</template>
