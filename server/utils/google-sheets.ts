import { google } from "googleapis";
import type { ColumnMapping } from "~~/types/mapping";
import { propertyTransformer } from "~~/server/services/propertyTransformer";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { createHash } from "crypto";

/**
 * Get Google Sheets OAuth2 configuration from environment variables
 */
export function getGoogleSheetsOAuthConfig() {
  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SHEETS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Sheets OAuth configuration missing. Please set GOOGLE_SHEETS_CLIENT_ID and GOOGLE_SHEETS_CLIENT_SECRET environment variables."
    );
  }

  return {
    clientId,
    clientSecret,
  };
}

/**
 * Create OAuth2 client for Google Sheets API
 */
export function createGoogleSheetsOAuthClient(
  accessToken: string,
  refreshToken: string
) {
  const config = getGoogleSheetsOAuthConfig();
  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

/**
 * Create Google Sheets API client
 */
export function createGoogleSheetsClient(
  accessToken: string,
  refreshToken: string
) {
  const oauth2Client = createGoogleSheetsOAuthClient(accessToken, refreshToken);
  return google.sheets({
    version: "v4",
    auth: oauth2Client,
  });
}

/**
 * Compute a checksum for a row to detect changes
 */
export function computeRowChecksum(
  row: (string | number | boolean)[]
): string {
  const normalized = JSON.stringify(row);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Transform a Notion page to a row of values based on mapping config
 */
export function transformPageToRowValues(
  page: PageObjectResponse,
  columns: ColumnMapping[]
): (string | number | boolean)[] {
  const rowValues: (string | number | boolean)[] = [];

  for (const column of columns) {
    const property = page.properties?.[column.notionPropertyName];
    const value = property
      ? propertyTransformer.transform(column.notionPropertyType, property)
      : "";
    rowValues.push(value);
  }

  return rowValues;
}

