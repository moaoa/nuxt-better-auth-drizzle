import { Queue, QueueEvents } from "bullmq";
import { BullMQOtel } from "bullmq-otel";
import { useDrizzle } from "~~/server/utils/drizzle";
import { automation } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { notionLogger } from "~~/lib/loggers";

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

export interface NotionSyncJobData {
  jobType: "sync" | "import";
  userId?: string;
  notionAccountId?: number;
  cursor?: string;
  // Import job fields
  automationId?: number;
  notionDatabaseId?: string;
  pageSize?: number;
}

export interface NotionSyncJobResult {
  status: "completed" | "failed";
  message?: string;
  next_cursor?: string | null;
  // Import job results
  pagesFetched?: number;
  hasMore?: boolean;
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

