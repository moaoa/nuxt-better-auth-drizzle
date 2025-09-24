export interface NotionPage {
  notion_id: string;
  titlePlain: string;
}

export const notionRepo = {
  getTopLevelPages: async () => {
    return await $fetch(`/api/notion/main-pages`);
  },
  getPageDatabases: async (pageId: string) => {
    return await $fetch(`/api/notion/pages/${pageId}/databases`);
  },
};
