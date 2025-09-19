import { Queue, Worker } from "bullmq";
import { Client } from "@notionhq/client";
import { notionAccount, type NotionEntity, notionEntity } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { eq } from "drizzle-orm";
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

export const notionSyncQueue = new Queue("notion-sync", { connection });

interface NotionSyncJobData {
  userId: string;
  notionAccountId: number;
}

interface NotionSyncJobResult {
  status: "completed" | "failed";
  message?: string;
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
  if (result.object === "page") {
    const titleProp = Object.values(result.properties).find(
      (prop) => prop.type === "title"
    );
    if (titleProp && titleProp.type === "title") {
      return titleProp.title[0]?.plain_text || "Untitled";
    }
  } else if (result.object === "database") {
    if (result.title && result.title[0]?.plain_text) {
      return result.title[0].plain_text;
    }
  }
  return "Untitled";
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
      const allPages: NotionSearchResult[] = [];

      while (hasMorePages) {
        const response: SearchResponse = await notion.search({
          filter: {
            property: "object",
            value: "page",
          },
        });

        allPages.push(...(response.results as NotionSearchResult[]));
        hasMorePages = response.has_more;
        nextCursorPages = response.next_cursor || undefined;
      }

      // Fetch databases
      let hasMoreDatabases = true;
      let nextCursorDatabases: string | undefined = undefined;
      const allDatabases: NotionSearchResult[] = [];

      while (hasMoreDatabases) {
        const response: SearchResponse = await notion.search({
          filter: {
            property: "object",
            value: "database",
          },
        });

        allDatabases.push(...(response.results as NotionSearchResult[]));
        hasMoreDatabases = response.has_more;
        nextCursorDatabases = response.next_cursor || undefined;
      }

      if (allPages.length === 0 && allDatabases.length === 0) {
        return {
          status: "failed",
          message: "No pages or databases were returned from notion",
        };
      }

      const allEntities: NotionSearchResult[] = [...allPages, ...allDatabases];

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
