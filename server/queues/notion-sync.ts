import { Queue, Worker } from "bullmq";
import { env } from "~~/config/env";
import { Client } from "@notionhq/client";
import { serviceAccount, notionEntities } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
};

export const notionSyncQueue = new Queue("notion-sync", { connection });

interface NotionSyncJobData {
  userId: string;
  serviceAccountId: number;
}

interface NotionSyncJobResult {
  status: "completed" | "failed";
  message?: string;
}

export const notionSyncWorker = new Worker<
  NotionSyncJobData,
  NotionSyncJobResult
>(
  "notion-sync",
  async (job) => {
    const { userId, serviceAccountId } = job.data;
    const db = useDrizzle();

    try {
      const account = await db.query.serviceAccount.findFirst({
        where: eq(serviceAccount.id, serviceAccountId),
      });

      if (!account) {
        throw new Error("Notion service account not found for user.");
      }

      const notion = new Client({
        auth: account.access_token,
      });

      let hasMore = true;
      let nextCursor: string | undefined = undefined;

      const existingEntities = await db.query.notionEntities.findMany({
        where: eq(notionEntities.user_id, userId),
      });

      while (hasMore) {
        const response = await notion.search({
          start_cursor: nextCursor,
          query: "*",
          filter: {
            property: "object",
            value: "page",
          },
        });

        const newEntities = response.results.filter((result) => {
          return !existingEntities.some(
            (entity) => entity.notion_entity_uuid === result.id
          );
        });

        db.insert(notionEntities).values(
          newEntities.map((result) => ({
            uuid: uuidv4(),
            notion_entity_uuid: result.id,
            name: "",
            parent_id: "",
            type: result.object,
            service_account_id: serviceAccountId,
            user_id: userId,
            service_id: account.service_id,
            is_child_of_workspace: result.object === "page",
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        );

        hasMore = response.has_more;
        nextCursor = response.next_cursor || undefined;
      }

      return {
        status: "completed",
        message: "Notion sync completed successfully.",
      };
    } catch (error: any) {
      console.error("Notion sync failed:", error);
      throw new Error(`Notion sync failed: ${error.message}`);
    }
  },
  { connection }
);
