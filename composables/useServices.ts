import { useQuery } from '@tanstack/vue-query'
import { servicesRepo } from '~/repositories/services'

export const useIsServiceConnected = (serviceKey: string) => {
  return useQuery({
    queryKey: ['service-connected', serviceKey],
    queryFn: () => servicesRepo.isConnected(serviceKey),
  })
}
