<script setup lang="ts">
import { ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-vue-next";

const props = defineProps<{
  databaseUuid: string | null;
}>();

const emit = defineEmits<{
  "columns-selected": [columns: Array<{ id: string; name: string; type: string }>];
  next: [];
  prev: [];
}>();

const selectedColumns = ref<Set<string>>(new Set());

// Fetch database properties
const {
  data: properties,
  isLoading,
  error,
} = useQuery({
  queryKey: ["notionDatabaseProperties", props.databaseUuid],
  queryFn: async () => {
    if (!props.databaseUuid) {
      return [];
    }
    return await $fetch(`/api/notion/databases/${props.databaseUuid}/properties`);
  },
  enabled: !!props.databaseUuid,
});

// Watch for property changes and auto-select all initially
watch(
  () => properties.value,
  (newProperties) => {
    if (newProperties && newProperties.length > 0) {
      // Auto-select all properties initially
      selectedColumns.value = new Set(
        newProperties.map((prop: any) => prop.id)
      );
    }
  },
  { immediate: true }
);

const toggleColumn = (columnId: string) => {
  const newSet = new Set(selectedColumns.value);
  if (newSet.has(columnId)) {
    newSet.delete(columnId);
  } else {
    newSet.add(columnId);
  }
  selectedColumns.value = newSet;
};

const isColumnSelected = (columnId: string) => {
  return selectedColumns.value.has(columnId);
};

const handleProceed = () => {
  if (!properties.value) {
    return;
  }

  const selected = Array.from(selectedColumns.value)
    .map((id) => properties.value?.find((p: any) => p.id === id))
    .filter(Boolean) as Array<{ id: string; name: string; type: string }>;

  emit("columns-selected", selected);
  emit("next");
};

const selectAll = () => {
  if (properties.value) {
    selectedColumns.value = new Set(properties.value.map((p: any) => p.id));
  }
};

const deselectAll = () => {
  selectedColumns.value.clear();
};
</script>

<template>
  <div class="space-y-4">
    <div>
      <h3 class="text-lg font-semibold mb-2">Select Columns to Sync</h3>
      <p class="text-sm text-muted-foreground mb-4">
        Choose which Notion database properties you want to sync to Google Sheets.
        The UUID column will be added automatically (hidden from view).
      </p>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Loader2 class="h-6 w-6 animate-spin" />
      <span class="ml-2">Loading properties...</span>
    </div>

    <div v-else-if="error" class="text-red-500">
      Failed to load database properties. Please try again.
    </div>

    <div v-else-if="properties && properties.length > 0" class="space-y-4">
      <div class="flex gap-2">
        <Button @click="selectAll" variant="outline" size="sm">
          Select All
        </Button>
        <Button @click="deselectAll" variant="outline" size="sm">
          Deselect All
        </Button>
      </div>

      <div class="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
        <div class="space-y-3">
          <div
            v-for="property in properties"
            :key="property.id"
            class="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
            @click="toggleColumn(property.id)"
          >
            <Checkbox
              :id="`column-${property.id}`"
              :checked="isColumnSelected(property.id)"
            />
            <Label
              :for="`column-${property.id}`"
              class="flex-1 cursor-pointer font-normal"
            >
              <div class="flex items-center justify-between">
                <span>{{ property.name }}</span>
                <span class="text-xs text-muted-foreground ml-2">
                  {{ property.type }}
                </span>
              </div>
            </Label>
          </div>
        </div>
      </div>

      <div class="text-sm text-muted-foreground">
        {{ selectedColumns.size }} of {{ properties.length }} columns selected
      </div>
    </div>

    <div v-else class="text-muted-foreground">
      No properties found for this database.
    </div>

    <div class="flex justify-between mt-6">
      <Button @click="$emit('prev')" variant="outline">Previous</Button>
      <Button
        @click="handleProceed"
        :disabled="selectedColumns.size === 0"
      >
        Continue
      </Button>
    </div>
  </div>
</template>

