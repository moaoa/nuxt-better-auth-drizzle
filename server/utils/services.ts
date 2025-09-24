
import type { NotionEntity } from "~~/types/notion";

const validateQuickbooksDb = (db: NotionEntity) => {
  // TODO: Implement validation logic for quickbooks
  return false;
};

const validateGoogleSheetsDb = (db: NotionEntity) => {
  // TODO: Implement validation logic for google sheets
  return false;
};

const validateNotionDb = (db: NotionEntity) => {
  // TODO: Implement validation logic for notion
  return false;
};

export const validateDb = (db: NotionEntity, serviceKey: string) => {
  switch (serviceKey) {
    case "quickbooks":
      return validateQuickbooksDb(db);
    case "google_sheet":
      return validateGoogleSheetsDb(db);
    case "notion":
      return validateNotionDb(db);
    default:
      return false;
  }
};
