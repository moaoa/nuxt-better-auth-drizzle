import {
  PageObjectResponse,
  DatabaseObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

type NotionSearchResult = PageObjectResponse | DatabaseObjectResponse;

type NotionParent =
  | PageObjectResponse["parent"]
  | DatabaseObjectResponse["parent"];

/**
 * Extract parent ID from a Notion parent object
 */
export function extractParentId(parent: NotionParent): string | null {
  if ("database_id" in parent) {
    return parent.database_id;
  }
  if ("page_id" in parent) {
    return parent.page_id;
  }
  if ("block_id" in parent) {
    return parent.block_id;
  }
  return null;
}

/**
 * Extract title from a Notion page
 */
export function extractPageTitle(page: PageObjectResponse): string {
  const titleProperty = Object.values(page.properties).find(
    (property) => property.type === "title"
  );

  if (titleProperty?.type !== "title") {
    return "Untitled";
  }

  const titleText = titleProperty.title
    .map((richText) => richText.plain_text)
    .join("");

  return titleText || "Untitled";
}

/**
 * Extract title from a Notion search result (page or database)
 */
export function extractTitleFromSearchResult(
  result: NotionSearchResult
): string {
  if (result.object === "database") {
    const titleText = result.title.map((richText) => richText.plain_text).join("");
    return titleText || "Untitled";
  }

  if (result.object === "page") {
    return extractPageTitle(result as PageObjectResponse);
  }

  return "Untitled";
}

/**
 * Get maximum page size for Notion API requests
 * Maximum: 100 pages per request (Notion API limit)
 */
export function getMaxPageSize(): number {
  return 100;
}

