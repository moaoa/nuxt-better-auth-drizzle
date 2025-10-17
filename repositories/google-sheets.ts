export const googleSheetsRepo = {
  getSheets: async () => {
    return $fetch("/api/google-sheets");
  },
};
