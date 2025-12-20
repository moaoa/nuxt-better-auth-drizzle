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
import {
  extractParentId,
  extractPageTitle,
  extractTitleFromSearchResult,
  getMaxPageSize,
} from "~~/server/utils/notion";

type NotionSearchResult = PageObjectResponse | DatabaseObjectResponse;

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
};

async function handleImportJob(
  jobData: NotionSyncJobData & { jobType: "import" }
): Promise<NotionSyncJobResult> {
  const { automationId, notionDatabaseId, cursor, pageSize } = jobData;

  if (!automationId || !notionDatabaseId) {
    throw new Error("Missing required fields for import job");
  }

  const db = useDrizzle();

  // Get automation
  const automationRecord = await db.query.automation.findFirst({
    where: eq(automation.id, automationId),
  });

  if (!automationRecord?.notionAccountId) {
    throw new Error(`Automation ${automationId} not found`);
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

  const maxPageSize = pageSize || getMaxPageSize();

  notionLogger.info(
    `Starting import for automation ${automationId}, database ${notionDatabaseId}, page size: ${maxPageSize}`
  );

  // Query Notion database
  const response = await notion.databases.query({
    database_id: notionDatabaseId,
    page_size: maxPageSize,
    start_cursor: cursor,
    sorts: [
      {
        timestamp: "last_edited_time",
        direction: "descending",
      },
    ],
  });

  const pages = response.results as PageObjectResponse[];

  notionLogger.info(
    `Fetched ${pages.length} pages from Notion database ${notionDatabaseId}`
  );

  // Handle empty results
  if (pages.length === 0) {
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

    return {
      status: "completed",
      pagesFetched: 0,
      hasMore: false,
      next_cursor: null,
    };
  }

  // Store pages in notionEntity table
  const entities: Omit<NotionEntity, "id">[] = pages.map((page) => ({
    notionId: page.id,
    parentId: notionDatabaseId,
    type: "page",
    accountId: automationRecord.notionAccountId!,
    archived: page.archived,
    titlePlain: extractPageTitle(page),
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

  // Queue headers job (only on first batch)
  if (!cursor) {
    const mappingRecord = await db.query.notionSheetsMapping.findFirst({
      where: eq(notionSheetsMapping.automationId, automationId),
    });

    if (mappingRecord) {
      const mappingConfig = mappingRecord.mappingConfig as MappingConfig;
      const headers = mappingConfig.columns.map(
        (col) => col.notionPropertyName
      );

      await addGoogleSheetsWriteHeadersJob({
        automationId,
        headers,
      });

      notionLogger.info(
        `Queued write-headers job for automation ${automationId} with ${headers.length} headers`
      );
    }
  }

  // Queue Google Sheets write jobs for fetched pages
  for (const page of pages) {
    await addGoogleSheetsWriteRowJob({
      automationId,
      notionPageId: page.id,
      eventType: "page.created",
    });
  }

  notionLogger.info(
    `Queued ${pages.length} Google Sheets write jobs for automation ${automationId}`
  );

  // Calculate total pages fetched so far
  const currentTotal = automationRecord.import_total_rows || 0;
  const newTotal = cursor ? currentTotal + pages.length : pages.length;

  // Handle pagination
  if (response.has_more && response.next_cursor && newTotal < 100) {
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
      pageSize: maxPageSize,
    });

    notionLogger.info(
      `Queued next batch for automation ${automationId} with cursor ${response.next_cursor}. Total pages so far: ${newTotal}`
    );
  } else {
    const finalTotal = Math.min(newTotal, 100);

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

  return {
    status: "completed",
    pagesFetched: pages.length,
    hasMore: response.has_more || false,
    next_cursor: response.next_cursor || null,
  };
}

async function handleSyncJob(
  jobData: NotionSyncJobData & { jobType: "sync" }
): Promise<NotionSyncJobResult> {
  const { userId, notionAccountId, cursor } = jobData;

  if (!userId || !notionAccountId) {
    throw new Error("Missing required fields for sync job");
  }

  const db = useDrizzle();

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

  if (allEntities.length === 0) {
    return {
      status: "completed",
      message: `Notion sync completed for cursor: ${cursor}`,
      next_cursor: response.next_cursor,
    };
  }

  const values: Omit<NotionEntity, "id">[] = allEntities.map((result) => ({
    notionId: result.id,
    parentId: extractParentId(result.parent),
    type: result.object,
    accountId: notionAccountId,
    archived: result.archived,
    titlePlain: extractTitleFromSearchResult(result),
    createdTime: new Date(result.created_time),
    lastEditedTime: new Date(result.last_edited_time),
    workspaceId: account.workspace_id,
    propertiesJson: result,
    user_id: userId,
  }));

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

  return {
    status: "completed",
    message: `Notion sync completed for cursor: ${cursor}`,
    next_cursor: response.next_cursor,
  };
}

export const notionSyncWorker = new Worker<
  NotionSyncJobData,
  NotionSyncJobResult
>(
  "notion-sync",
  async (job) => {
    const { jobType } = job.data;

    try {
      if (jobType === "import") {
        return await handleImportJob(job.data as NotionSyncJobData & { jobType: "import" });
      }

      if (jobType === "sync") {
        return await handleSyncJob(job.data as NotionSyncJobData & { jobType: "sync" });
      }

      throw new Error(`Unknown job type: ${jobType}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (job.data.jobType === "import" && job.data.automationId) {
        const db = useDrizzle();
        await db
          .update(automation)
          .set({
            import_status: "failed",
          })
          .where(eq(automation.id, job.data.automationId));

        notionLogger.error(
          `Notion import failed for automation ${job.data.automationId}: ${errorMessage}`,
          { error: error instanceof Error ? error.stack : undefined }
        );
      } else {
        notionLogger.error(`Notion sync failed: ${errorMessage}`);
      }

      throw new Error(
        `Notion ${job.data.jobType} failed: ${errorMessage}`
      );
    }
  },
  {
    connection,
    telemetry: new BullMQOtel("notion-sync-worker"),
    limiter: {
      max: 3,
      duration: 1000,
    },
  }
);
