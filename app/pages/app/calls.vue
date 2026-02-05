<script lang="ts" setup>
import { useQuery } from "@tanstack/vue-query";

const page = ref(1);
const limit = 20;

// Fetch call history
const { data: callsData, isLoading, refetch } = useQuery({
  queryKey: ["calls", page.value],
  queryFn: async () => {
    const response = await $fetch("/api/calls/history", {
      query: {
        page: page.value,
        limit,
      },
    });
    return response;
  },
});

const calls = computed(() => callsData.value?.calls || []);
const pagination = computed(() => callsData.value?.pagination || {});

const formatDuration = (seconds: number | null) => {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatDate = (date: string | Date | null) => {
  if (!date) return "—";
  return new Date(date).toLocaleString();
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    completed: "text-green-600 dark:text-green-400",
    failed: "text-red-600 dark:text-red-400",
    busy: "text-orange-600 dark:text-orange-400",
    "no-answer": "text-yellow-600 dark:text-yellow-400",
    answered: "text-blue-600 dark:text-blue-400",
    ringing: "text-blue-600 dark:text-blue-400",
    initiated: "text-gray-600 dark:text-gray-400",
  };
  return colors[status] || "text-muted-foreground";
};
</script>

<template>
  <main class="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
    <div class="mx-auto w-full max-w-6xl">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">Call History</h1>
        <UiButton variant="outline" @click="refetch()">
          <Icon name="lucide:refresh-cw" class="mr-2" />
          Refresh
        </UiButton>
      </div>

      <!-- Calls Table -->
      <div class="bg-card rounded-lg border overflow-hidden">
        <div v-if="isLoading" class="p-8 text-center">
          <p class="text-muted-foreground">Loading calls...</p>
        </div>
        <div v-else-if="calls.length === 0" class="p-8 text-center">
          <p class="text-muted-foreground">No calls yet. Start making calls from the dialer!</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead class="border-b">
              <tr>
                <th class="text-left p-4 font-medium">To</th>
                <th class="text-left p-4 font-medium">From</th>
                <th class="text-left p-4 font-medium">Status</th>
                <th class="text-left p-4 font-medium">Duration</th>
                <th class="text-left p-4 font-medium">Cost</th>
                <th class="text-left p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="call in calls"
                :key="call.id"
                class="border-b hover:bg-muted/50"
              >
                <td class="p-4 font-mono text-sm">{{ call.toNumber }}</td>
                <td class="p-4 font-mono text-sm">{{ call.fromNumber }}</td>
                <td class="p-4">
                  <span
                    class="capitalize"
                    :class="getStatusColor(call.status)"
                  >
                    {{ call.status }}
                  </span>
                </td>
                <td class="p-4">{{ formatDuration(call.cost?.durationSeconds || call.durationSeconds) }}</td>
                <td class="p-4">
                  <span v-if="call.cost?.userPriceUsd" class="font-medium">
                    ${{ call.cost.userPriceUsd.toFixed(2) }}
                  </span>
                  <span v-else class="text-muted-foreground">—</span>
                </td>
                <td class="p-4 text-sm text-muted-foreground">
                  {{ formatDate(call.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="mt-4 flex items-center justify-between">
        <p class="text-sm text-muted-foreground">
          Page {{ pagination.page }} of {{ pagination.totalPages }}
        </p>
        <div class="flex gap-2">
          <UiButton
            variant="outline"
            :disabled="page === 1"
            @click="page--"
          >
            Previous
          </UiButton>
          <UiButton
            variant="outline"
            :disabled="page >= pagination.totalPages"
            @click="page++"
          >
            Next
          </UiButton>
        </div>
      </div>
    </div>
  </main>
</template>





