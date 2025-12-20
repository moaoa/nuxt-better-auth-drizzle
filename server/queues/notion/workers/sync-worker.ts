import { Worker } from "bullmq";
import { Client } from "@notionhq/client";
import {
  notionAccount,
  type NotionEntity,
  notionEntity,
  automation,
  notionSheetsMapping,
} from "~~/db/schema";
import type { MappingConfig } from "~~/types/mapping";
import { useDrizzle } from "~~/server/utils/drizzle";
import { eq } from "drizzle-orm";
import { BullMQOtel } from "bullmq-otel";
import {
  PageObjectResponse,
  DatabaseObjectResponse,
  SearchResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {
  addGoogleSheetsWriteRowJob,
  addGoogleSheetsWriteHeadersJob,
} from "../../google_sheets/queue";
import { notionLogger } from "~~/lib/loggers";
import type {
  NotionSyncJobData,
  NotionSyncJobResult,
} from "../queue";
import { addNotionImportJob } from "../queue";

type NotionSearchResult = PageObjectResponse | DatabaseObjectResponse;

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
};

function getParentId(
  parent: PageObjectResponse["parent"] | DatabaseObjectResponse["parent"]
): string | null {
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

function getTitle(result: NotionSearchResult): string {
  if (result.object === "database") {
    return (
      result.title.map((richText) => richText.plain_text).join("") || "Untitled"
    );
  }

  if (result.object === "page") {
    const titleProperty = Object.values(result.properties).find(
      (property) => property.type === "title"
    );
    if (titleProperty?.type === "title") {
      return (
        titleProperty.title.map((richText) => richText.plain_text).join("") ||
        "Untitled"
      );
    }
  }

  return "Untitled";
}

/**
 * Calculate optimal page size for Notion API requests
 * Maximum page size: 100 pages per request (Notion API limit)
 */
function calculateOptimalPageSize(): number {
  return 100;
}

/**
 * Get title from a Notion page
 */
function getPageTitle(page: PageObjectResponse): string {
  const titleProperty = Object.values(page.properties).find(
    (property) => property.type === "title"
  );
  if (titleProperty?.type === "title") {
    return (
      titleProperty.title.map((richText) => richText.plain_text).join("") ||
      "Untitled"
    );
  }
  return "Untitled";
}

export const notionSyncWorker = new Worker<
  NotionSyncJobData,
  NotionSyncJobResult
>(
  "notion-sync",
  async (job) => {
    const db = useDrizzle();
    const { jobType } = job.data;

    // Handle import jobs
    if (jobType === "import") {
      const { automationId, notionDatabaseId, cursor, pageSize } = job.data;

      if (!automationId || !notionDatabaseId) {
        throw new Error("Missing required fields for import job");
      }

      try {
        // 1. Get automation
        const automationRecord = await db.query.automation.findFirst({
          where: eq(automation.id, automationId),
        });

        if (!automationRecord || !automationRecord.notionAccountId) {
          throw new Error(`Automation ${automationId} not found`);
        }

        // 2. Get Notion account
        const account = await db.query.notionAccount.findFirst({
          where: eq(notionAccount.id, automationRecord.notionAccountId),
        });

        if (!account) {
          throw new Error("Notion account not found");
        }

        // 3. Initialize Notion client
        const notion = new Client({
          auth: account.access_token,
        });

        // 4. Calculate optimal page size
        const optimalPageSize = pageSize || calculateOptimalPageSize();

        notionLogger.info(
          `Starting import for automation ${automationId}, database ${notionDatabaseId}, page size: ${optimalPageSize}`
        );

        // 5. Query Notion database
        const response = await notion.databases.query({
          database_id: notionDatabaseId,
          page_size: optimalPageSize,
          start_cursor: cursor,
          sorts: [
            {
              timestamp: "last_edited_time",
              direction: "descending", // Get most recently edited pages first
            },
          ],
        });

        const pages = response.results as PageObjectResponse[];

        notionLogger.info(
          `Fetched ${pages.length} pages from Notion database ${notionDatabaseId}`
        );

        // 6. Store pages in notionEntity table
        if (pages.length > 0) {
          const entities: Omit<NotionEntity, "id">[] = pages.map((page) => ({
            notionId: page.id,
            parentId: notionDatabaseId,
            type: "page",
            accountId: automationRecord.notionAccountId!,
            archived: page.archived,
            titlePlain: getPageTitle(page),
            createdTime: new Date(page.created_time),
            lastEditedTime: new Date(page.last_edited_time),
            workspaceId: account.workspace_id,
            propertiesJson: page,
            user_id: automationRecord.user_id,
          }));

          await db
            .insert(notionEntity)
            .values(entities)
            .onConflictDoUpdate({
              target: notionEntity.notionId,
              set: {
                parentId: notionDatabaseId,
                titlePlain: notionEntity.titlePlain,
                archived: notionEntity.archived,
                lastEditedTime: notionEntity.lastEditedTime,
                propertiesJson: notionEntity.propertiesJson,
              },
            });

          notionLogger.info(
            `Stored ${pages.length} pages in notionEntity table for automation ${automationId}`
          );

          // 7. Queue headers job (only on first batch, when cursor is undefined)
          if (!cursor) {
            // Get mapping config to extract header names
            const mappingRecord = await db.query.notionSheetsMapping.findFirst({
              where: eq(notionSheetsMapping.automationId, automationId),
            });

            if (mappingRecord) {
              const mappingConfig =
                mappingRecord.mappingConfig as MappingConfig;

              // Extract header names from column mappings in order
              const headers = mappingConfig.columns.map(
                (col) => col.notionPropertyName
              );

              // Queue write-headers job
              await addGoogleSheetsWriteHeadersJob({
                automationId,
                headers,
              });

              notionLogger.info(
                `Queued write-headers job for automation ${automationId} with ${headers.length} headers`
              );
            }
          }

          // 8. Queue Google Sheets write jobs for fetched pages
          for (const page of pages) {
            await addGoogleSheetsWriteRowJob({
              automationId,
              notionPageId: page.id,
              eventType: "page.created", // Treat as new rows for initial import
            });
          }

          notionLogger.info(
            `Queued ${pages.length} Google Sheets write jobs for automation ${automationId}`
          );

          // 9. Calculate total pages fetched so far
          const currentTotal = automationRecord.import_total_rows || 0;
          const newTotal = cursor
            ? currentTotal + pages.length // For subsequent batches, add to existing total
            : pages.length; // For first batch, set to pages fetched

          // 10. If there are more pages and we haven't exceeded 100 pages, queue next batch
          if (response.has_more && response.next_cursor && newTotal < 100) {
            // Update total rows and queue next batch
            await db
              .update(automation)
              .set({
                import_total_rows: newTotal,
              })
              .where(eq(automation.id, automationId));

            await addNotionImportJob({
              automationId,
              notionDatabaseId,
              cursor: response.next_cursor,
              pageSize: optimalPageSize,
            });

            notionLogger.info(
              `Queued next batch for automation ${automationId} with cursor ${response.next_cursor}. Total pages so far: ${newTotal}`
            );
          } else {
            // All pages fetched (or reached 100 limit) - update final total
            const finalTotal = Math.min(newTotal, 100); // Cap at 100 for initial import

            await db
              .update(automation)
              .set({
                import_total_rows: finalTotal,
              })
              .where(eq(automation.id, automationId));

            if (finalTotal >= 100) {
              notionLogger.info(
                `Reached 100 page limit for automation ${automationId}. Fetched ${finalTotal} pages. Waiting for Google Sheets writes to complete.`
              );
            } else {
              notionLogger.info(
                `All pages fetched for automation ${automationId}. Total: ${finalTotal} pages. Waiting for Google Sheets writes to complete.`
              );
            }
          }
        } else {
          // No pages found - mark as completed immediately
          await db
            .update(automation)
            .set({
              import_status: "completed",
              import_completed_at: new Date(),
              import_total_rows: 0,
            })
            .where(eq(automation.id, automationId));

          notionLogger.info(
            `No pages found in database ${notionDatabaseId} for automation ${automationId}. Marking as completed.`
          );
        }

        return {
          status: "completed",
          pagesFetched: pages.length,
          hasMore: response.has_more || false,
          next_cursor: response.next_cursor || null,
        };
      } catch (error: any) {
        // Update automation status to failed
        await db
          .update(automation)
          .set({
            import_status: "failed",
          })
          .where(eq(automation.id, automationId));

        notionLogger.error(
          `Notion import failed for automation ${automationId}: ${error.message}`,
          { error: error.stack }
        );

        throw new Error(`Notion import failed: ${error.message}`);
      }
    }

    // Handle sync jobs (existing logic)
    const { userId, notionAccountId, cursor } = job.data;

    if (!userId || !notionAccountId) {
      throw new Error("Missing required fields for sync job");
    }

    try {
      const account = await db.query.notionAccount.findFirst({
        where: eq(notionAccount.id, notionAccountId),
      });

      if (!account) {
        throw new Error("Notion service account not found for user.");
      }

      const notion = new Client({
        auth: account.access_token,
      });

      const response: SearchResponse = await notion.search({
        start_cursor: cursor,
      });

      const allEntities = response.results as NotionSearchResult[];

      if (allEntities.length > 0) {
        const values: Omit<NotionEntity, "id">[] = allEntities.map(
          (result) => ({
            notionId: result.id,
            parentId: getParentId(result.parent),
            type: result.object,
            accountId: notionAccountId,
            archived: result.archived,
            titlePlain: getTitle(result),
            createdTime: new Date(result.created_time),
            lastEditedTime: new Date(result.last_edited_time),
            workspaceId: account.workspace_id,
            propertiesJson: result,
            user_id: userId,
          })
        );

        await db
          .insert(notionEntity)
          .values(values)
          .onConflictDoUpdate({
            target: notionEntity.notionId,
            set: {
              parentId: notionEntity.parentId,
              type: notionEntity.type,
              titlePlain: notionEntity.titlePlain,
              archived: notionEntity.archived,
              lastEditedTime: notionEntity.lastEditedTime,
              propertiesJson: notionEntity.propertiesJson,
            },
          });
      }

      return {
        status: "completed",
        message: `Notion sync completed for cursor: ${cursor}`,
        next_cursor: response.next_cursor,
      };
    } catch (error: any) {
      console.error("Notion sync failed:", error);
      throw new Error(`Notion sync failed: ${error.message}`);
    }
  },
  {
    connection,
    telemetry: new BullMQOtel("notion-sync-worker"),
    limiter: {
      max: 3,
      duration: 1000, // 3 jobs per second
    },
  }
);

