import { useQuery } from '@tanstack/vue-query';
import { useSession } from '~~/lib/auth-client';

export const useAuthSession = () => {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: session } = await useSession(useFetch);
      return session.value;
    },
  });
};