import { Queue, Worker } from "bullmq";
import { Client } from "@notionhq/client";
import { notionAccount, type NotionEntity, notionEntity } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { SearchResponse } from "@notionhq/client/build/src/api-endpoints";

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

      // Fetch pages
      let hasMorePages = true;
      let nextCursorPages: string | undefined = undefined;
      const allPages: SearchResponse["results"] = [];

      console.log("Fetching pages...");
      while (hasMorePages) {
        const response = await notion.search({
          // start_cursor: nextCursorPages,
          query: "",
          filter: {
            property: "object",
            value: "page",
          },
        });

        console.log("Pages response:", response);
        allPages.push(...response.results);
        hasMorePages = response.has_more;
        nextCursorPages = response.next_cursor || undefined;
      }

      // Fetch databases
      let hasMoreDatabases = true;
      let nextCursorDatabases: string | undefined = undefined;
      const allDatabases: SearchResponse["results"] = [];

      console.log("Fetching databases...");
      while (hasMoreDatabases) {
        const response = await notion.search({
          // start_cursor: nextCursorDatabases,
          query: "",
          filter: {
            property: "object",
            value: "database",
          },
        });

        console.log("Databases response:", response);
        allDatabases.push(...response.results);
        hasMoreDatabases = response.has_more;
        nextCursorDatabases = response.next_cursor || undefined;
      }

      if (allPages.length === 0 && allDatabases.length === 0) {
        return {
          status: "failed",
          message: "No pages or databases were returned from notion",
        };
      }

      const allEntities = [...allPages, ...allDatabases];

      if (allEntities.length > 0) {
        const values: NotionEntity[] = allEntities.map((result) => ({
          notion_id: result.id,
          parent_id: result.id,
          type: result.object,
          accountId: notionAccountId,
          archived: result.object,
          titlePlain: result.properties.Title.title[0].plain_text,
          createdTime: result.created_time,
          lastEditedTime: result.last_edited_time,
          workspaceId: result.parent.id,
          propertiesJson: result,
          user_id: userId,
          is_child_of_workspace: result.object === "page",
        }));

        await db
          .insert(notionEntity)
          .values(values)
          .onConflictDoNothing({ target: notionEntity.notionId });
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
