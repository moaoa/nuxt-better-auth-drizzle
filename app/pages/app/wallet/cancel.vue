<script lang="ts" setup>
const router = useRouter();

const goToWallet = () => {
  router.push("/app/wallet");
};
</script>

<template>
  <main class="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
    <div class="mx-auto w-full max-w-2xl">
      <div class="p-8 bg-card rounded-lg border text-center">
        <div class="mb-6">
          <div class="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mb-4">
            <Icon name="lucide:x" class="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          <h1 class="text-3xl font-bold mb-2">Payment Cancelled</h1>
          <p class="text-muted-foreground">
            Your payment was cancelled. No charges were made.
          </p>
        </div>

        <div class="flex gap-4 justify-center">
          <UiButton @click="goToWallet" size="lg">
            <Icon name="lucide:wallet" class="mr-2" />
            Back to Wallet
          </UiButton>
        </div>
      </div>
    </div>
  </main>
</template>
