import { z } from 'zod'

// Generic schema creator function
export function createGenericSchema<T extends Record<string, z.ZodTypeAny>>(
  schemaDefinition: T
) {
  return z.object(schemaDefinition)
}


// Utility type to infer schema type
export type InferSchemaType<T extends z.ZodObject<any>> = z.infer<T>

// Type helper for column definitions
export type TableColumn<T> = {
  key: keyof T
  header: string
  cell?: (value: any) => any
  sortable?: boolean
  filterable?: boolean
}
