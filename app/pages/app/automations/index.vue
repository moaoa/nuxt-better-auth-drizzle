<template>
  <div class="flex flex-col">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">My Automations</h1>
      <NuxtLink
        to="/app/services"
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        New Automation
      </NuxtLink>
    </div>
    <table
      v-if="status === 'success'"
      class="table-auto min-w-full divide-y divide-gray-200"
    >
      <thead class="bg-gray-50">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            Name
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            Status
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            Created
          </th>
          <th scope="col" class="relative px-6 py-3">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr
          v-for="automation in automations ?? []"
          :key="automation.uuid"
          class="hover:bg-gray-50"
        >
          <td class="px-6 py-4 whitespace-nowrap">
            {{ automation.name }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center gap-2">
              <!-- Import status indicator -->
              <div
                v-if="automation.import_status === 'importing'"
                class="flex items-center gap-2 text-sm"
              >
                <Loader2 class="h-4 w-4 animate-spin text-blue-500" />
                <span class="text-gray-600">Importing...</span>
                <span
                  v-if="
                    automation.import_total_rows &&
                    automation.import_processed_rows !== undefined
                  "
                  class="text-gray-500 text-xs"
                >
                  ({{
                    Math.round(
                      (automation.import_processed_rows /
                        automation.import_total_rows) *
                        100
                    )
                  }}% - {{ automation.import_processed_rows }} /
                  {{ automation.import_total_rows }})
                </span>
                <span
                  v-else-if="automation.import_total_rows"
                  class="text-gray-500 text-xs"
                >
                  ({{ automation.import_total_rows }} rows)
                </span>
              </div>
              <div
                v-else-if="automation.import_status === 'completed'"
                class="flex items-center gap-2 text-sm text-green-600"
              >
                <CheckCircle class="h-4 w-4" />
                <span>Import complete</span>
              </div>
              <div
                v-else-if="automation.import_status === 'failed'"
                class="flex items-center gap-2 text-sm text-red-600"
              >
                <XCircle class="h-4 w-4" />
                <span>Import failed</span>
              </div>
              <!-- Active status badge -->
              <Badge
                :variant="automation.is_active ? 'default' : 'secondary'"
                class="text-xs"
              >
                {{ automation.is_active ? "Active" : "Inactive" }}
              </Badge>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {{ formatDate(automation.createdAt) }}
          </td>
          <td
            class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
          >
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost">...</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Edit</DropdownMenuItem>
                <DropdownMenuItem
                  @click="handleDelete(automation.uuid)"
                  class="text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="status === 'error'">
      {{ error }}
    </div>
    <div v-else-if="status === 'pending'">Loading...</div>
    <div v-else-if="status === 'idle'">No automations found</div>
  </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useToast } from "@/components/ui/toast/use-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-vue-next";
import type { Automation } from "~/types/automations";
import { computed, onMounted, onUnmounted, watch } from "vue";

const { toast } = useToast();
const queryClient = useQueryClient();

// Fetch automations with useQuery for polling support
const {
  data: automations,
  status,
  error,
  refetch,
} = useQuery({
  queryKey: ["automations"],
  queryFn: async () => {
    const response = await $fetch<Automation[]>("/api/automations");
    return response;
  },
  retry: 3,
  retryDelay: 1000,
});

// Polling logic
let pollInterval: ReturnType<typeof setInterval> | null = null;

const hasImportingAutomations = computed(() => {
  return (
    automations.value?.some((a) => a.import_status === "importing") || false
  );
});

const startPolling = () => {
  if (pollInterval) return;

  // Poll every 10 seconds
  pollInterval = setInterval(() => {
    refetch();

    // Stop polling if no importing automations
    if (!hasImportingAutomations.value) {
      stopPolling();
    }
  }, 10000); // 10 seconds
};

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};

onMounted(() => {
  // Start polling if there are importing automations
  if (hasImportingAutomations.value) {
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});

// Watch for importing automations
watch(hasImportingAutomations, (newValue) => {
  if (newValue && !pollInterval) {
    startPolling();
  } else if (!newValue && pollInterval) {
    stopPolling();
  }
});

// Watch for status changes to show toast notifications
watch(
  () => automations.value,
  (newAutomations, oldAutomations) => {
    if (!oldAutomations) return;

    newAutomations?.forEach((automation) => {
      const oldAutomation = oldAutomations.find(
        (a) => a.uuid === automation.uuid
      );

      if (
        oldAutomation?.import_status === "importing" &&
        automation.import_status === "completed"
      ) {
        toast({
          title: "Import Complete",
          description: `Import completed for ${automation.name}`,
        });
      }

      if (
        oldAutomation?.import_status === "importing" &&
        automation.import_status === "failed"
      ) {
        toast({
          title: "Import Failed",
          description: `Import failed for ${automation.name}`,
          variant: "destructive",
        });
      }
    });
  },
  { deep: true }
);

const formatDate = (dateString: string | Date) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const deleteMutation = useMutation({
  mutationFn: async (automationUuid: string) => {
    await $fetch(`/api/automations/${automationUuid}`, {
      method: "DELETE",
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["automations"] });
    refetch();
    toast({
      title: "Success",
      description: "Automation deleted successfully",
    });
  },
  onError: (error: any) => {
    console.error("Failed to delete automation:", error);
    toast({
      title: "Error",
      description:
        error.data?.message || error.message || "Failed to delete automation",
      variant: "destructive",
    });
  },
});

const handleDelete = (automationUuid: string) => {
  if (confirm("Are you sure you want to delete this automation?")) {
    deleteMutation.mutate(automationUuid);
  }
};
</script>
