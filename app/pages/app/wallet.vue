<script lang="ts" setup>
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { z } from "zod";

const queryClient = useQueryClient();

// Fetch wallet balance
const { data: wallet, isLoading: walletLoading } = useQuery({
  queryKey: ["wallet"],
  queryFn: async () => {
    const response = await $fetch("/api/wallet");
    return response;
  },
});

// Fetch credit transactions
const { data: transactions, isLoading: transactionsLoading } = useQuery({
  queryKey: ["credit-transactions"],
  queryFn: async () => {
    // Note: You'd need to create this endpoint
    // For now, we'll just show wallet info
    return [];
  },
});

// Purchase credits form
const purchaseAmount = ref(10); // Default $10
const purchaseSchema = z.object({
  amountUsd: z.number().positive().min(0.01),
});

const purchaseMutation = useMutation({
  mutationFn: async (amountUsd: number) => {
    return await $fetch("/api/credits/purchase", {
      method: "POST",
      body: { amountUsd },
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
    purchaseAmount.value = 10;
  },
});

const handlePurchase = () => {
  const validated = purchaseSchema.parse({ amountUsd: purchaseAmount.value });
  purchaseMutation.mutate(validated.amountUsd);
};

const presetAmounts = [5, 10, 25, 50, 100];
</script>

<template>
  <main class="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
    <div class="mx-auto w-full max-w-4xl">
      <h1 class="text-3xl font-bold mb-6">Wallet</h1>

      <!-- Balance Card -->
      <div class="mb-6 p-6 bg-card rounded-lg border">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground mb-1">Current Balance</p>
            <p class="text-4xl font-bold" v-if="!walletLoading">
              ${{ wallet?.balanceUsd?.toFixed(2) || "0.00" }}
            </p>
            <p class="text-lg text-muted-foreground" v-if="!walletLoading">
              {{ wallet?.balanceCredits || 0 }} credits
            </p>
            <p class="text-xs text-muted-foreground mt-2">
              1 credit = $0.01 USD
            </p>
          </div>
        </div>
      </div>

      <!-- Purchase Credits -->
      <div class="mb-6 p-6 bg-card rounded-lg border">
        <h2 class="text-xl font-semibold mb-4">Purchase Credits</h2>
        
        <div class="space-y-4">
          <!-- Preset Amounts -->
          <div>
            <p class="text-sm font-medium mb-2">Quick Select</p>
            <div class="flex flex-wrap gap-2">
              <UiButton
                v-for="amount in presetAmounts"
                :key="amount"
                variant="outline"
                :class="{ 'border-primary': purchaseAmount === amount }"
                @click="purchaseAmount = amount"
              >
                ${{ amount }}
              </UiButton>
            </div>
          </div>

          <!-- Custom Amount -->
          <div>
            <label class="text-sm font-medium mb-2 block">Custom Amount (USD)</label>
            <UiInput
              v-model.number="purchaseAmount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="10.00"
            />
          </div>

          <!-- Purchase Button -->
          <UiButton
            @click="handlePurchase"
            :disabled="purchaseMutation.isPending || purchaseAmount <= 0"
            class="w-full"
            size="lg"
          >
            <Icon name="lucide:credit-card" class="mr-2" />
            Purchase ${{ purchaseAmount.toFixed(2) }} in Credits
          </UiButton>

          <p v-if="purchaseMutation.isSuccess" class="text-sm text-green-600 dark:text-green-400">
            Credits purchased successfully!
          </p>
          <p v-if="purchaseMutation.isError" class="text-sm text-destructive">
            Failed to purchase credits. Please try again.
          </p>
        </div>
      </div>

      <!-- Transaction History -->
      <div class="p-6 bg-card rounded-lg border">
        <h2 class="text-xl font-semibold mb-4">Transaction History</h2>
        <div v-if="transactionsLoading" class="text-center py-8">
          <p class="text-muted-foreground">Loading transactions...</p>
        </div>
        <div v-else-if="!transactions || transactions.length === 0" class="text-center py-8">
          <p class="text-muted-foreground">No transactions yet</p>
        </div>
        <div v-else class="space-y-2">
          <!-- Transaction items would go here -->
          <p class="text-sm text-muted-foreground">Transaction history coming soon</p>
        </div>
      </div>
    </div>
  </main>
</template>





