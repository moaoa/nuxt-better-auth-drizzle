import { h } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";
import DataTableColumnHeader from "../DataTableColumnHeader.vue";
import DataTableRowActions from "./DataTableRowActions.vue";
import type { Service } from "./schema";

export const columns: ColumnDef<Service>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => h(DataTableColumnHeader, { column, title: "Name" }),
    cell: ({ row }) => h("div", row.getValue("name")),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "description",
    header: ({ column }) =>
      h(DataTableColumnHeader, { column, title: "Description" }),
    cell: ({ row }) => h("div", row.getValue("description")),
  },
  {
    id: "actions",
    cell: ({ row }) => h(DataTableRowActions, { row }),
  },
];
