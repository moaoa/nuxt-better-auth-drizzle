import { Worker } from "bullmq";
import { Client } from "@notionhq/client";
import { notionAccount, notionEntity, automation } from "~~/db/schema";
import { useDrizzle } from "~~/server/utils/drizzle";
import { eq } from "drizzle-orm";
import { BullMQOtel } from "bullmq-otel";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { addGoogleSheetsWriteRowJob } from "../../google_sheets/queue";
import { notionLogger } from "~~/lib/loggers";
import type {
  NotionPageFetchJobData,
  NotionPageFetchJobResult,
} from "../queue";

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
};

function getParentId(
  parent: PageObjectResponse["parent"]
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

function getTitle(page: PageObjectResponse): string {
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

