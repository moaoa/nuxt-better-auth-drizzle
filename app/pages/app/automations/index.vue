<template>
  <div class="flex flex-col">
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
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr
          v-for="automation in automations?.automations ?? []"
          :key="automation.automation.uuid"
          class="hover:bg-gray-50"
        >
          <td class="px-6 py-4 whitespace-nowrap">
            {{ automation.automation.name }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {{ automation.automation.description }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {{ formatDate(automation.automation.createdAt) }}
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
const {
  data: automations,
  status,
  error,
} = await useFetch("/api/automations", {
  method: "GET",
});

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
</script>
