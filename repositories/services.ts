import { $fetch } from "ofetch";

export const servicesRepo = {
  isConnected: async (serviceKey: string) => {
    return await $fetch(`/api/services/${serviceKey}/is-connected`);
  },
};
