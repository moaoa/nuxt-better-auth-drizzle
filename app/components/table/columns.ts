import { UiAvatar, UiAvatarFallback, UiAvatarImage } from '#components';
import { admin } from 'better-auth/plugins';
import type { ColumnDef } from '@tanstack/vue-table'
import { h } from 'vue'
// import { Badge } from '../ui/badge'
import { Checkbox } from '../ui/checkbox'
import DataTableColumnHeader from './DataTableColumnHeader.vue'
import DataTableRowActions from './DataTableRowActions.vue'
import type { TableColumn } from './schema'
import { Badge } from '../ui/badge'

// Define a type for action menu items
export type ActionMenuItem = {
  label: string
  icon?: any
  action: (row: any) => void
  isVisible?: (row: any) => boolean
}

const labels: Record<string, string> = {
  admin: 'Admin',
  user: 'User'
}

// Updated generateColumns function with optional custom actions
export function generateColumns<T extends Record<string, any>>(
  columns: TableColumn<T>[],
  options: {
    selectable?: boolean,
    actions?: {
      enabled?: boolean
      menuItems?: ActionMenuItem[]
    }
  } = {}
): ColumnDef<T>[] {
  const baseColumns: ColumnDef<T>[] = columns.map(col => ({
    accessorKey: col.key as string,
    header: ({ column }) => h(DataTableColumnHeader, {
      column,
      title: col.header
    }),
    cell: ({ row }) => {
      const value = row.getValue(col.key as string)
      // If the column is role use badge component
      const shouldBeInBadge = ['role', 'status', 'banned']

      if (shouldBeInBadge.includes(col.key as string)) {
        const isBanned = col.key === 'banned';
        return h(Badge, { class: 'uppercase', variant: value === 'admin' ? 'secondary' : 'outline' },
          { default: () => !isBanned ? value : value ? 'Banned' : 'Active' })
      }

      if (col.key === 'image') {
        const username = row.getValue('name') as string;
        return h(UiAvatar, { class: 'h-8 w-8 rounded-lg' }, () => {
          return [
            h(UiAvatarImage, { src: value || '', alt: username }),
            h(UiAvatarFallback, { class: 'rounded-lg' }, () => username?.charAt(0) || 'CN'),
          ]
        })
      }
      //@ts-ignore
      return col.cell ? col.cell(value) : h('div', value)
    },
    enableSorting: col.sortable ?? true,
    enableHiding: col.filterable ?? true,
  }))

  // Optional select column
  if (options.selectable) {
    baseColumns.unshift({
      id: 'select',
      header: ({ table }) => h(Checkbox, {
        'checked': table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate'),
        'onUpdate:checked': (value: any) => table.toggleAllPageRowsSelected(!!value),
        'ariaLabel': 'Select all',
        'class': 'translate-y-0.5',
      }),
      cell: ({ row }) => h(Checkbox, {
        'checked': row.getIsSelected(),
        'onUpdate:checked': (value: any) => row.toggleSelected(!!value),
        'ariaLabel': 'Select row',
        'class': 'translate-y-0.5'
      }),
      enableSorting: false,
      enableHiding: false,
    })
  }

  // Optional actions column
  if (options.actions?.enabled !== false) {
    baseColumns.push({
      id: 'actions',
      cell: ({ row }) => h(DataTableRowActions, {
        row,
        menuItems: options.actions?.menuItems
      }),
    })
  }

  return baseColumns
}

