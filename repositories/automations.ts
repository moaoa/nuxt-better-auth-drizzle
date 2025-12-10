export enum AutomationType {
  NotionToGoogleSheet = 'notion-to-google-sheet',
  GoogleSheetToNotion = 'google-sheet-to-notion',
}

export interface AutomationConfig {
    sourceId: string;
    destinationId?: string;
    createDestination?: boolean;
    newDestinationName?: string;
    parentPageId?: string;
}

export const automationsRepo = {
  createNotionToGoogleSheetAutomation: async (config: AutomationConfig) => {
    return await $fetch(`/api/automations/notion-to-google-sheet`, {
      method: "POST",
      body: config,
    });
  },
  createGoogleSheetToNotionAutomation: async (config: AutomationConfig) => {
    return await $fetch(`/api/automations/google-sheet-to-notion`, {
      method: "POST",
      body: config,
    });
  },
};