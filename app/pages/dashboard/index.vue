<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">Dashboard</h1>

    <div class="space-y-6">
      <!-- Workspaces Section -->
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">Your Workspaces</h2>
          <button
            @click="initiateNotionAuth"
            class="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors text-sm"
          >
            + Add Workspace
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"
          ></div>
          <p class="mt-2 text-gray-600">Loading workspaces...</p>
        </div>

        <!-- Error State -->
        <div
          v-else-if="error"
          class="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-4"
        >
          <p>Error loading workspaces: {{ error.message }}</p>
          <button
            @click="fetchWorkspaces"
            class="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Retry
          </button>
        </div>

        <!-- Empty State -->
        <div v-else-if="!workspaces.length" class="text-center py-8">
          <p class="text-gray-600 mb-4">No workspaces found</p>
          <button
            @click="initiateNotionAuth"
            class="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
          >
            Connect Your First Workspace
          </button>
        </div>

        <!-- Workspaces Table -->
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
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
                  Workspace ID
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Created
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="workspace in workspaces"
                :key="workspace.id"
                class="hover:bg-gray-50"
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div
                      v-if="workspace.icon"
                      class="flex-shrink-0 h-8 w-8 mr-3"
                    >
                      <img
                        class="h-8 w-8 rounded"
                        :src="workspace.icon"
                        :alt="`${workspace.name} icon`"
                      />
                    </div>
                    <div class="text-sm font-medium text-gray-900">
                      {{ workspace.name }}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ workspace.notion_workspace_id }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(workspace.created_at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNotionAuth } from "~~/composables/useNotionAuth";
import { useWorkspaces } from "~~/composables/useWorkspaces";

const { initiateAuth } = useNotionAuth();
const { workspaces, loading, error, fetchWorkspaces } = useWorkspaces();

// Fetch workspaces when component mounts
onMounted(() => {
  fetchWorkspaces();
});

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const initiateNotionAuth = () => {
  initiateAuth();
};
</script>
