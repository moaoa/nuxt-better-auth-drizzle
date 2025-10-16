import { Queue, Worker, QueueEvents } from "bullmq";
import { Client } from "@notionhq/client";
import { notionAccount, type NotionEntity, notionEntity } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { eq } from "drizzle-orm";
import { BullMQOtel } from "bullmq-otel";
import {
  SearchResponse,
  PageObjectResponse,
  DatabaseObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

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
  console.log(`Job ${jobId} completed`);
  console.log("return value from notion-sync: ", returnvalue);
  const job = await notionSyncQueue.getJob(jobId);
  if (job && returnvalue) {
    const newData = { ...job.data, cursor: returnvalue };
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
