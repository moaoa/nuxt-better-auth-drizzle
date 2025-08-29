import { z } from 'zod'

export const serviceSchema = z.object({
  id: z.number(),
  name: z.string(),
  service_key: z.string(),
  description: z.string(),
  icon: z.string(),
})

export type Service = z.infer<typeof serviceSchema>
