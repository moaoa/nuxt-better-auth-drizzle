enum AutomationType {
  NotionToGoogleSheet,
  GoogleSheetToNotion,
}

export interface CreateAutomationParams {
  type: AutomationType;
  googleSheetId?: string;
  notionEntityId?: string;
  config: {
    createNewGoogleSheet?: boolean;
    createNewNotionDb?: boolean;
  };
}

export const notionRepo = {
  createAutomation: async (params: CreateAutomationParams) => {
    return await $fetch(`/api/automations`, {
      method: "POST",
      body: params,
    });
  },
};
