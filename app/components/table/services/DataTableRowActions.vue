<script setup lang="ts">
import type { Row } from '@tanstack/vue-table'
import { computed } from 'vue'
import { serviceSchema } from './schema'

interface DataTableRowActionsProps {
  row: Row<unknown>
}

const props = defineProps<DataTableRowActionsProps>()

const service = computed(() => serviceSchema.parse(props.row.original))
</script>

<template>
  <div>
    <!-- Actions will go here -->
  </div>
</template>
