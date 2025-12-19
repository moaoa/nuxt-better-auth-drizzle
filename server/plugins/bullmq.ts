import { notionSyncWorker } from "~~/server/queues/notion-sync";
import { googleSheetsWorker } from "~~/server/queues/googleSheetsQueue";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("close", async () => {
    await notionSyncWorker.close();
    await googleSheetsWorker.close();
  });
});
