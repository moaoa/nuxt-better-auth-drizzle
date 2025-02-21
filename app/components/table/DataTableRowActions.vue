<script setup lang="ts">
import type { Row } from '@tanstack/vue-table'
import type { ActionMenuItem } from './columns'
import { computed } from 'vue'

import { MoreHorizontal } from 'lucide-vue-next'


interface DataTableRowActionsProps {
  row: Row<any>
  menuItems?: ActionMenuItem[]
}

const props = withDefaults(defineProps<DataTableRowActionsProps>(), {
  menuItems: () => []
})

// Default action menu items if none are provided
const defaultMenuItems: ActionMenuItem[] = [
  {
    label: 'Edit',
    action: () => console.log('Edit'),
    isVisible: () => true
  },
  {
    label: 'Make a copy',
    action: () => console.log('Make a copy'),
    isVisible: () => true
  },
  {
    label: 'Favorite',
    action: () => console.log('Favorite'),
    isVisible: () => true
  },
  {
    label: 'Delete',
    action: () => console.log('Delete'),
    isVisible: () => true
  }
]

// Combine default and custom menu items
const actionMenuItems = computed(() =>
  props.menuItems.length > 0 ? props.menuItems : defaultMenuItems
)

// Filter visible menu items
const visibleMenuItems = computed(() =>
  actionMenuItems.value.filter(item =>
    item.isVisible ? item.isVisible(props.row.original) : true
  )
)

</script>

<template>
  <UiDropdownMenu>
    <UiDropdownMenuTrigger as-child>
      <UiButton variant="ghost" size="sm" class="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
        <MoreHorizontal class="h-4 w-4" />
        <span class="sr-only">Open menu</span>
      </UiButton>
    </UiDropdownMenuTrigger>
    <UiDropdownMenuContent align="end" class="w-[160px]">
      <UiDropdownMenuLabel>Actions</UiDropdownMenuLabel>
      <UiDropdownMenuSeparator />
      <UiDropdownMenuItem v-for="(item, index) in visibleMenuItems" :key="index"
        @select="() => item.action(row.original)">
        <component v-if="item.icon" :is="item.icon" class="mr-2 h-4 w-4" />
        {{ item.label }}
      </UiDropdownMenuItem>
    </UiDropdownMenuContent>
  </UiDropdownMenu>
</template>
