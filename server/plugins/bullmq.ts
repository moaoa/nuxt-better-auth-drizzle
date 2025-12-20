import { notionSyncWorker } from "~~/server/queues/notion/workers/sync-worker";
import { notionPageFetchWorker } from "~~/server/queues/notion/workers/page-fetch-worker";
import { googleSheetsWorker } from "~~/server/queues/google_sheets/workers/sheets-worker";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("close", async () => {
    await notionSyncWorker.close();
    await notionPageFetchWorker.close();
    await googleSheetsWorker.close();
  });
});
