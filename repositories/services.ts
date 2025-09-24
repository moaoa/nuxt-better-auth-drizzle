import type { ServiceKey } from "~~/types/services";

export const servicesRepo = {
  isConnected: async (serviceKey: ServiceKey) => {
    return await $fetch(`/api/services/${serviceKey}/is-connected`);
  },
};
