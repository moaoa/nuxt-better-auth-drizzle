<script lang="ts" setup>
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { z } from "zod";
import {
  ALLOWED_TOPUP_AMOUNTS_USD,
  isValidTopupAmount,
  MIN_TOPUP_AMOUNT_USD,
  MAX_TOPUP_AMOUNT_USD,
} from "~~/lib/wallet-topup";

const queryClient = useQueryClient();

// Fetch wallet balance
const { data: wallet, isLoading: walletLoading } = useQuery({
  queryKey: ["wallet"],
  queryFn: async () => {
    const response = await $fetch("/api/wallet");
    return response;
  },
});

// Pagination state
const currentPage = ref(1);
const perPage = 10;

// Fetch transactions
const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
  queryKey: computed(() => ["transactions", currentPage.value]),
  queryFn: async () => {
    const response = await $fetch("/api/wallet/transactions", {
      params: { page: currentPage.value, limit: perPage },
    });
    return response;
  },
});

const transactions = computed(() => transactionsData.value?.transactions || []);
const pagination = computed(() => transactionsData.value?.pagination || { page: 1, limit: perPage, total: 0, totalPages: 0 });

// Purchase credits form
const purchaseAmount = ref<number>(10);
const purchaseError = ref<string | null>(null);
const purchaseSchema = z.object({
  amountUsd: z.number().refine(isValidTopupAmount, {
    message: `Amount must be between $${MIN_TOPUP_AMOUNT_USD.toFixed(2)} and $${MAX_TOPUP_AMOUNT_USD.toFixed(2)} with up to 2 decimal places.`,
  }),
});

interface InvoiceCreateResponse {
  invoiceUrl: string;
  invoiceId: string;
  paymentId: number;
}

const purchaseMutation = useMutation<InvoiceCreateResponse, Error, number>({
  mutationFn: async (amountUsd: number) => {
    // Create NOWPayments invoice
    const response = await $fetch<InvoiceCreateResponse>("/api/nowpayments/invoice/create", {
      method: "POST",
      body: { amountUsd },
    });
    return response;
  },
  onSuccess: (data) => {
    // Redirect to NOWPayments hosted payment page
    if (data.invoiceUrl) {
      window.location.href = data.invoiceUrl;
    }
  },
});

const handlePurchase = () => {
  const validated = purchaseSchema.safeParse({ amountUsd: purchaseAmount.value });
  if (!validated.success) {
    purchaseError.value = validated.error.issues[0]?.message || "Invalid amount";
    return;
  }

  purchaseError.value = null;
  purchaseMutation.mutate(validated.data.amountUsd);
};

const presetAmounts = ALLOWED_TOPUP_AMOUNTS_USD;
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
          </div>
        </div>
      </div>

      <!-- Add Funds -->
      <div class="mb-6 p-6 bg-card rounded-lg border">
        <h2 class="text-xl font-semibold mb-4">Add Funds</h2>
        
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
                @click="
                  purchaseAmount = amount;
                  purchaseError = null;
                "
              >
                ${{ amount }}
              </UiButton>
            </div>
          </div>

          <div>
            <p class="text-sm font-medium mb-2">Custom Amount (USD)</p>
            <UiInput
              v-model.number="purchaseAmount"
              type="number"
              :min="MIN_TOPUP_AMOUNT_USD"
              :max="MAX_TOPUP_AMOUNT_USD"
              step="0.01"
              placeholder="Enter amount"
              @input="purchaseError = null"
            />
            <p class="text-xs text-muted-foreground mt-1">
              Enter an amount between ${{ MIN_TOPUP_AMOUNT_USD.toFixed(2) }} and ${{ MAX_TOPUP_AMOUNT_USD.toFixed(2) }}.
            </p>
          </div>

          <!-- Purchase Button -->
          <UiButton
            @click="handlePurchase"
            :disabled="purchaseMutation.isPending"
            class="w-full"
            size="lg"
          >
            <Icon name="lucide:wallet" class="mr-2" />
            <span v-if="purchaseMutation.isPending">Redirecting to payment...</span>
            <span v-else>Add ${{ purchaseAmount.toFixed(2) }} to Wallet</span>
          </UiButton>
          <p v-if="purchaseError" class="text-sm text-destructive">
            {{ purchaseError }}
          </p>
          <p v-if="purchaseMutation.isError" class="text-sm text-destructive">
            Failed to create payment. Please try again.
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
          <div
            v-for="transaction in transactions"
            :key="transaction.id"
            class="p-4 border rounded-lg flex items-center justify-between"
          >
            <div>
              <p class="font-medium">
                {{ transaction.type === 'purchase' ? 'Credit Purchase' : transaction.type === 'call_charge' ? 'Call Charge' : 'Refund' }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ new Date(transaction.createdAt).toLocaleString() }}
              </p>
            </div>
            <div class="text-right">
              <p
                class="font-bold"
                :class="{
                  'text-green-600 dark:text-green-400': parseFloat(transaction.amountUsd || '0') > 0,
                  'text-red-600 dark:text-red-400': parseFloat(transaction.amountUsd || '0') < 0,
                }"
              >
                {{ parseFloat(transaction.amountUsd || '0') > 0 ? '+' : '' }}${{ Math.abs(parseFloat(transaction.amountUsd || '0')).toFixed(2) }}
              </p>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="pagination.totalPages > 1" class="flex items-center justify-between pt-4">
            <p class="text-sm text-muted-foreground">
              Showing {{ (pagination.page - 1) * pagination.limit + 1 }}–{{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }} transactions
            </p>
            <div class="flex items-center gap-1">
              <UiButton
                variant="outline"
                size="icon"
                class="h-8 w-8"
                :disabled="currentPage <= 1"
                @click="currentPage = 1"
              >
                <Icon name="lucide:chevrons-left" class="h-4 w-4" />
              </UiButton>
              <UiButton
                variant="outline"
                size="icon"
                class="h-8 w-8"
                :disabled="currentPage <= 1"
                @click="currentPage--"
              >
                <Icon name="lucide:chevron-left" class="h-4 w-4" />
              </UiButton>

              <template v-for="page in pagination.totalPages" :key="page">
                <UiButton
                  v-if="page === 1 || page === pagination.totalPages || (page >= currentPage - 1 && page <= currentPage + 1)"
                  :variant="page === currentPage ? 'default' : 'outline'"
                  size="icon"
                  class="h-8 w-8"
                  @click="currentPage = page"
                >
                  {{ page }}
                </UiButton>
                <span
                  v-else-if="page === currentPage - 2 || page === currentPage + 2"
                  class="px-1 text-muted-foreground"
                >
                  …
                </span>
              </template>

              <UiButton
                variant="outline"
                size="icon"
                class="h-8 w-8"
                :disabled="currentPage >= pagination.totalPages"
                @click="currentPage++"
              >
                <Icon name="lucide:chevron-right" class="h-4 w-4" />
              </UiButton>
              <UiButton
                variant="outline"
                size="icon"
                class="h-8 w-8"
                :disabled="currentPage >= pagination.totalPages"
                @click="currentPage = pagination.totalPages"
              >
                <Icon name="lucide:chevrons-right" class="h-4 w-4" />
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>





