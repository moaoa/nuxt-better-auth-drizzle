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
  createDatabase: async (name: string, workspaceUUID: string) => {
    const data = await $fetch(`/api/notion/databases/${workspaceUUID}`, {
      method: "POST",
      body: { name },
    });
    return data;
  },
  getDatabases: async (workspaceUUID: string) => {
    const data = await $fetch(`/api/notion/databases/${workspaceUUID}`);
    return data;
  },
  createAutomation: async (service_id: string) => {
    const data = await $fetch("/api/automations", {
      method: "POST",
      body: { service_id },
    });
    return data;
  },
};
