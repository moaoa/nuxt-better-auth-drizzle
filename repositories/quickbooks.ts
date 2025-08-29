export const quickbooksRepository = {
  index: async () => {
    const data = await $fetch("/api/quickbooks/services");
    return data;
  },
  saveService: async (service: string, notion_db_id: string) => {
    const data = await $fetch("/api/user/service", {
      method: "POST",
      body: { service, notion_db_id },
    });
    return data;
  },
  createDatabase: async (name: string) => {
    const data = await $fetch("/api/notion/databases", {
      method: "POST",
      body: { name },
    });
    return data;
  },
  getDatabases: async () => {
    const data = await $fetch("/api/notion/databases");
    return data;
  },
  createAutomation: async (service_id: string) => {
    const data = await $fetch("/api/automations", {
      method: "POST",
      body: { service_id },
    });
    return data;
  },
  createConnection: async (service_id: string, user_name: string) => {
    const data = await $fetch("/api/connections", {
      method: "POST",
      body: { service_id, user_name },
    });
    return data;
  },
};