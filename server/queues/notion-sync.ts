import { Queue, Worker, QueueEvents } from "bullmq";
import { Client } from "@notionhq/client";
import {
  notionAccount,
  type NotionEntity,
  notionEntity,
  automation,
} from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { eq } from "drizzle-orm";
import { BullMQOtel } from "bullmq-otel";
import {
  SearchResponse,
  PageObjectResponse,
  DatabaseObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {
  addGoogleSheetsWriteRowJob,
  addGoogleSheetsDeleteRowJob,
} from "./googleSheetsQueue";
import { notionLogger } from "~~/lib/loggers";

type NotionSearchResult = PageObjectResponse | DatabaseObjectResponse;

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
};

export const notionSyncQueue = new Queue("notion-sync", {
  connection,
  telemetry: new BullMQOtel("notion-sync-queue"),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

// Queue for fetching individual Notion pages (used by webhooks)
export const notionPageFetchQueue = new Queue("notion-page-fetch", {
  connection,
  telemetry: new BullMQOtel("notion-page-fetch-queue"),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

interface NotionSyncJobData {
  jobType: "sync" | "import";
  userId?: string;
  notionAccountId?: number;
  cursor?: string;
  // Import job fields
  automationId?: number;
  notionDatabaseId?: string;
  pageSize?: number;
}

interface NotionSyncJobResult {
  status: "completed" | "failed";
  message?: string;
  next_cursor?: string | null;
  // Import job results
  pagesFetched?: number;
  hasMore?: boolean;
}

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
 * Job data for fetching a single Notion page
 */
export interface NotionPageFetchJobData {
  automationId: number;
  notionPageId: string;
  eventType?: string;
}

/**
 * Result of fetching a Notion page
 */
export interface NotionPageFetchJobResult {
  status: "completed" | "failed";
  message?: string;
  notionPageId: string;
}

/**
 * Add a job to fetch a single Notion page
 */
export const addNotionPageFetchJob = async (data: NotionPageFetchJobData) => {
  const jobId = `notion-page-fetch-${data.automationId}-${
    data.notionPageId
  }-${Date.now()}`;
  return notionPageFetchQueue.add("fetch-notion-page", data, { jobId });
};

export const addNotionSyncJob = async (
  data: Omit<NotionSyncJobData, "jobType"> & {
    userId: string;
    notionAccountId: number;
  }
) => {
  const cursor = data.cursor || "initial";
  return notionSyncQueue.add(
    "notion-sync-job",
    {
      jobType: "sync",
      ...data,
    } as NotionSyncJobData,
    {
      jobId: `fetch-notion-entities-${data.userId}-${cursor}`,
    }
  );
};

/**
 * Add a job to import Notion database pages (initial import)
 */
export const addNotionImportJob = async (data: {
  automationId: number;
  notionDatabaseId: string;
  cursor?: string;
  pageSize?: number;
}) => {
  const jobId = `notion-import-${data.automationId}-${
    data.cursor || "initial"
  }-${Date.now()}`;
  return notionSyncQueue.add(
    "notion-import-job",
    {
      jobType: "import",
      automationId: data.automationId,
      notionDatabaseId: data.notionDatabaseId,
      cursor: data.cursor,
      pageSize: data.pageSize,
    } as NotionSyncJobData,
    { jobId }
  );
};

export const notionSyncQueueEvents = new QueueEvents("notion-sync", {
  connection,
});

notionSyncQueueEvents.on("completed", async ({ jobId, returnvalue }) => {
  const job = await notionSyncQueue.getJob(jobId);
  if (job && returnvalue && typeof returnvalue === "object") {
    const jobData = job.data as NotionSyncJobData;
    const result = returnvalue as NotionSyncJobResult;

    // Handle import job completion
    if (jobData.jobType === "import" && jobData.automationId) {
      // When import job completes and there are no more pages to fetch,
      // ensure import_total_rows is set correctly
      if (!result.hasMore && result.pagesFetched !== undefined) {
        const db = useDrizzle();
        const automationRecord = await db.query.automation.findFirst({
          where: eq(automation.id, jobData.automationId),
          columns: {
            import_total_rows: true,
            import_status: true,
          },
        });

        if (
          automationRecord &&
          automationRecord.import_status === "importing"
        ) {
          // Ensure the total is set correctly (it should already be set, but double-check)
          const currentTotal = automationRecord.import_total_rows || 0;
          if (currentTotal === 0 && result.pagesFetched > 0) {
            // This shouldn't happen, but if it does, set it
            await db
              .update(automation)
              .set({
                import_total_rows: result.pagesFetched,
              })
              .where(eq(automation.id, jobData.automationId));

            notionLogger.info(
              `Updated import_total_rows to ${result.pagesFetched} for automation ${jobData.automationId} after Notion fetch completed`
            );
          }
        }
      }
    }

    // Only auto-continue for sync jobs, not import jobs
    if (
      jobData.jobType === "sync" &&
      jobData.userId &&
      jobData.notionAccountId
    ) {
      await addNotionSyncJob({
        userId: jobData.userId,
        notionAccountId: jobData.notionAccountId,
        cursor: result.next_cursor || jobData.cursor,
      });
    }
  }
});

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

          // 7. Queue Google Sheets write jobs for fetched pages
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

          // 8. Calculate total pages fetched so far
          const currentTotal = automationRecord.import_total_rows || 0;
          const newTotal = cursor
            ? currentTotal + pages.length // For subsequent batches, add to existing total
            : pages.length; // For first batch, set to pages fetched

          // 9. If there are more pages and we haven't exceeded 100 pages, queue next batch
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

/**
 * Worker for fetching individual Notion pages (used by webhooks)
 * After fetching, it queues a mapping sync job
 */
export const notionPageFetchWorker = new Worker<
  NotionPageFetchJobData,
  NotionPageFetchJobResult
>(
  "notion-page-fetch",
  async (job) => {
    const { automationId, notionPageId } = job.data;
    const db = useDrizzle();

    try {
      // Get automation to find the Notion account
      const automationRecord = await db.query.automation.findFirst({
        where: eq(automation.id, automationId),
      });

      if (!automationRecord || !automationRecord.notionAccountId) {
        throw new Error(
          `Automation ${automationId} not found or has no Notion account`
        );
      }

      // Get Notion account
      const account = await db.query.notionAccount.findFirst({
        where: eq(notionAccount.id, automationRecord.notionAccountId),
      });

      if (!account) {
        throw new Error("Notion account not found");
      }

      // Initialize Notion client
      const notion = new Client({
        auth: account.access_token,
      });

      // Fetch the page from Notion API
      const page = (await notion.pages.retrieve({
        page_id: notionPageId,
      })) as PageObjectResponse;

      // Transform page data for storage
      const titlePlain = getTitle(page);
      const parentId = getParentId(page.parent);

      // Store or update the page in the database
      await db
        .insert(notionEntity)
        .values({
          notionId: page.id,
          parentId: parentId,
          type: page.object as "page" | "database",
          accountId: account.id,
          workspaceId: account.workspace_id,
          archived: page.archived,
          titlePlain,
          createdTime: new Date(page.created_time),
          lastEditedTime: new Date(page.last_edited_time),
          propertiesJson: page,
        })
        .onConflictDoUpdate({
          target: notionEntity.notionId,
          set: {
            parentId: parentId,
            type: page.object as "page" | "database",
            titlePlain,
            archived: page.archived,
            lastEditedTime: new Date(page.last_edited_time),
            propertiesJson: page,
          },
        });

      notionLogger.info(
        `Fetched and stored Notion page ${notionPageId} for automation ${automationId}`
      );

      // Queue Google Sheets write job after successful fetch
      // Pass eventType so the worker knows if it's a new row or update
      await addGoogleSheetsWriteRowJob({
        automationId,
        notionPageId,
        eventType: job.data.eventType,
      });

      notionLogger.info(
        `Queued Google Sheets write job for page ${notionPageId} after fetch`
      );

      return {
        status: "completed",
        message: `Page ${notionPageId} fetched and queued for sync`,
        notionPageId,
      };
    } catch (error: any) {
      notionLogger.error(
        `Page fetch failed for ${notionPageId}: ${error.message}`
      );
      throw new Error(`Page fetch failed: ${error.message}`);
    }
  },
  {
    connection,
    telemetry: new BullMQOtel("notion-page-fetch-worker"),
    limiter: {
      max: 3,
      duration: 1000, // 3 requests per second (Notion rate limit)
    },
  }
);
