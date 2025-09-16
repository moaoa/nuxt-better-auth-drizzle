import { Queue, Worker } from "bullmq";
import { Client } from "@notionhq/client";
import { notionAccount, notionEntities } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
};

export const notionSyncQueue = new Queue("notion-sync", { connection });

interface NotionSyncJobData {
  userId: string;
  notionAccountId: number;
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
    const { userId, notionAccountId } = job.data;
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

        console.log(response);

        if (response.results.length === 0) {
          return {
            status: "failed",
            message: "No pages or databases were returned from notion",
          };
        }

        db.insert(notionEntities)
          .values(
            response.results.map((result) => ({
              uuid: uuidv4(),
              notion_entity_uuid: result.id,
              name: "",
              parent_id: "",
              type: result.object,
              notion_account_id: notionAccountId,
              user_id: userId,
              is_child_of_workspace: result.object === "page",
              createdAt: new Date(),
              updatedAt: new Date(),
            }))
          )
          .onConflictDoNothing({ target: notionEntities.notion_entity_uuid });

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
