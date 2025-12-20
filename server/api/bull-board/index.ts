import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { H3Adapter } from "@bull-board/h3";
import {
  notionSyncQueue,
  notionPageFetchQueue,
} from "~~/server/queues/notion/queue";
import { googleSheetsQueue } from "~~/server/queues/google_sheets/queue";

const serverAdapter = new H3Adapter();
serverAdapter.setBasePath("/api/bull-board");

createBullBoard({
  queues: [
    new BullMQAdapter(notionSyncQueue),
    new BullMQAdapter(notionPageFetchQueue),
    new BullMQAdapter(googleSheetsQueue),
  ],
  serverAdapter,
});

const router = serverAdapter.registerHandlers();

export default defineEventHandler((event) => router.handler(event));
