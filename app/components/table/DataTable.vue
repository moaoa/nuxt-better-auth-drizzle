<script setup lang="ts">
import {
  FlexRender,
  getCoreRowModel,
  useVueTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from '@tanstack/vue-table'
import type { ColumnDef } from '@tanstack/vue-table'
import { ref } from 'vue'

import { Input } from '../ui/input'
import DataTableToolbar from './DataTableToolbar.vue'
import { valueUpdater } from '~~/lib/utils'

interface Props<T> {
  columns: ColumnDef<T>[]
  data: T[]
  options?: {
    enableGlobalFilter?: boolean
    enablePagination?: boolean,
    filterOptions?: {
      label: string
      value: string
      icon?: Component
    }[]
  }
}

const props = withDefaults(defineProps<Props<any>>(), {
  options: () => ({
    enableGlobalFilter: true,
    enablePagination: true,
    filterOptions: []
  })
})

const globalFilter = ref('')
const sorting = ref([])
const pagination = ref({
  pageIndex: 0,
  pageSize: 10,
})

const table = useVueTable({
  get data() { return props.data },
  get columns() { return props.columns },
  state: {
    get globalFilter() { return globalFilter.value },
    get sorting() { return sorting.value },
    get pagination() { return pagination.value },
  },
  onGlobalFilterChange: (updaterOrValue) => {
    globalFilter.value = typeof updaterOrValue === 'function'
      ? updaterOrValue(globalFilter.value)
      : updaterOrValue
  },
  onSortingChange: updaterOrValue => valueUpdater(updaterOrValue, sorting),
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
})
</script>

<template>
  <div class="space-y-4">
    <!-- Global Filter -->
    <DataTableToolbar :table="table">
      <template #filter>
        <div v-if="props.options.enableGlobalFilter" class="flex items-center py-4">
          <Input v-model="globalFilter" placeholder="Filter items..." class="max-w-sm" />
        </div>
      </template>
    </DataTableToolbar>
    <!-- Table -->
    <div class="rounded-md border">
      <UiTable class="w-full">
        <UiTableHeader>
          <UiTableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <UiTableHead v-for="header in headerGroup.headers" :key="header.id" class="border-b p-2 text-left">
              <FlexRender v-if="!header.isPlaceholder" :render="header.column.columnDef.header"
                :props="header.getContext()" />
            </UiTableHead>
          </UiTableRow>
        </UiTableHeader>
        <UiTableBody>
          <UiTableRow v-for="row in table.getRowModel().rows" :key="row.id"
            class="border-b hover:bg-gray-100 dark:hover:bg-gray-800">
            <UiTableCell v-for="cell in row.getVisibleCells()" :key="cell.id" class="p-2">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>
    </div>
    <DataTablePagination :table="table" v-if="props.options.enablePagination" />
  </div>
</template>
