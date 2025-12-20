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
import {
  extractParentId,
  extractPageTitle,
} from "~~/server/utils/notion";

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
};

async function fetchAndStorePage(
  automationId: number,
  notionPageId: string,
  eventType?: string
): Promise<NotionPageFetchJobResult> {
  const db = useDrizzle();

  // Get automation
  const automationRecord = await db.query.automation.findFirst({
    where: eq(automation.id, automationId),
  });

  if (!automationRecord?.notionAccountId) {
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
  const titlePlain = extractPageTitle(page);
  const parentId = extractParentId(page.parent);

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
    `Fetched and stored Notion page ${notionPageId} for automation ${automationId} (event: ${eventType || "unknown"})`
  );

  // Queue Google Sheets write job
  // This job will:
  // 1. Load the page data from notionEntity table
  // 2. Find the corresponding row in Google Sheets using the Notion UUID column
  // 3. Update the row if it exists, or create a new one if it doesn't
  await addGoogleSheetsWriteRowJob({
    automationId,
    notionPageId,
    eventType,
  });

  notionLogger.info(
    `Queued Google Sheets write job for page ${notionPageId} after fetch. The job will detect and update the corresponding row using the Notion UUID column.`
  );

  return {
    status: "completed",
    message: `Page ${notionPageId} fetched and queued for sync`,
    notionPageId,
  };
}

export const notionPageFetchWorker = new Worker<
  NotionPageFetchJobData,
  NotionPageFetchJobResult
>(
  "notion-page-fetch",
  async (job) => {
    const { automationId, notionPageId, eventType } = job.data;

    try {
      return await fetchAndStorePage(automationId, notionPageId, eventType);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      notionLogger.error(
        `Page fetch failed for ${notionPageId}: ${errorMessage}`
      );
      
      throw new Error(`Page fetch failed: ${errorMessage}`);
    }
  },
  {
    connection,
    telemetry: new BullMQOtel("notion-page-fetch-worker"),
    limiter: {
      max: 3,
      duration: 1000,
    },
  }
);
