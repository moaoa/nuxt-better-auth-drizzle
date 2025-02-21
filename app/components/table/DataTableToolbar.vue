<script setup lang="ts">
import type { Table } from '@tanstack/vue-table'

import { computed } from 'vue'

interface DataTableToolbarProps {
  table: Table<any>
}

const props = defineProps<DataTableToolbarProps>()

const isFiltered = computed(() => props.table.getState().columnFilters.length > 0)
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="flex flex-1 items-center space-x-2">
      <slot name="filter" />
      <UiButton v-if="isFiltered" variant="ghost" class="h-8 px-2 lg:px-3" @click="table.resetColumnFilters()">
        Reset
        <Icon name="radix-icons:x" class="ml-2 h-4 w-4" />
      </UiButton>
    </div>
    <DataTableViewOptions :table="table" />
  </div>
</template>
