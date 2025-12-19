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
            Description
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
          v-for="automation in automations?.data ?? []"
          :key="automation.uuid"
          class="hover:bg-gray-50"
        >
          <td class="px-6 py-4 whitespace-nowrap">
            {{ automation.name }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {{ automation.description }}
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
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { useToast } from "@/components/ui/toast/use-toast";

const { toast } = useToast();
const queryClient = useQueryClient();

const { data: automations, status, error, refresh } = await useFetch("/api/automations");

const formatDate = (dateString: string) => {
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
    refresh();
    toast({
      title: "Success",
      description: "Automation deleted successfully",
    });
  },
  onError: (error: any) => {
    console.error("Failed to delete automation:", error);
    toast({
      title: "Error",
      description: error.data?.message || error.message || "Failed to delete automation",
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
