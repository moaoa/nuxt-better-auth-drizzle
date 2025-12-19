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
  userId: string;
  notionAccountId: number;
  cursor?: string;
}

interface NotionSyncJobResult {
  status: "completed" | "failed";
  message?: string;
  next_cursor?: string | null;
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

export const addNotionSyncJob = async (data: NotionSyncJobData) => {
  const cursor = data.cursor || "initial";
  return notionSyncQueue.add("notion-sync-job", data, {
    jobId: `fetch-notion-entities-${data.userId}-${cursor}`,
  });
};

export const notionSyncQueueEvents = new QueueEvents("notion-sync", {
  connection,
});

notionSyncQueueEvents.on("completed", async ({ jobId, returnvalue }) => {
  const job = await notionSyncQueue.getJob(jobId);
  if (job && returnvalue) {
    const newData = { ...job.data, ...returnvalue };
    await addNotionSyncJob(newData);
  }
});

export const notionSyncWorker = new Worker<
  NotionSyncJobData,
  NotionSyncJobResult
>(
  "notion-sync",
  async (job) => {
    const { userId, notionAccountId, cursor } = job.data;
    const db = useDrizzle();

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
      await addGoogleSheetsWriteRowJob({
        automationId,
        notionPageId,
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
