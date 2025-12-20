import { Queue, QueueEvents } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
};

/**
 * Job data for listing spreadsheets (metadata sync)
 */
export interface GoogleSheetsListJobData {
  jobType: "list-spreadsheets";
  userId: string;
  accessToken: string;
  refreshToken: string;
  pageToken?: string;
}

/**
 * Job data for writing a row to Google Sheets
 */
export interface GoogleSheetsWriteRowJobData {
  jobType: "write-row";
  automationId: number;
  notionPageId: string;
  eventType?: string; // e.g., "page.created", "page.content_updated", "page.properties_updated"
}

/**
 * Job data for deleting a row from Google Sheets
 */
export interface GoogleSheetsDeleteRowJobData {
  jobType: "delete-row";
  automationId: number;
  notionPageId: string;
}

/**
 * Job data for writing headers to Google Sheets
 */
export interface GoogleSheetsWriteHeadersJobData {
  jobType: "write-headers";
  automationId: number;
  headers: string[]; // Array of header names in order
}

/**
 * Union type for all Google Sheets job data
 */
export type GoogleSheetsJobData =
  | GoogleSheetsListJobData
  | GoogleSheetsWriteRowJobData
  | GoogleSheetsDeleteRowJobData
  | GoogleSheetsWriteHeadersJobData;

export interface GoogleSheetsJobResult {
  status: "completed" | "failed";
  message?: string;
  nextPageToken?: string | null;
  rowsProcessed?: number;
  rowsCreated?: number;
  rowsUpdated?: number;
  rowsDeleted?: number;
}

export const GOOGLE_SHEETS_QUEUE_NAME = "google-sheets-queue" as const;

export const googleSheetsQueue = new Queue<GoogleSheetsJobData>(
  GOOGLE_SHEETS_QUEUE_NAME,
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
    telemetry: new BullMQOtel("google-sheets-queue"),
  }
);

/**
 * Add a job to list Google Sheets (metadata sync)
 */
export const addGoogleSheetsListJob = async (
  data: Omit<GoogleSheetsListJobData, "jobType">
) => {
  const page = data.pageToken || "initial";
  return googleSheetsQueue.add(
    "list-spreadsheets",
    { ...data, jobType: "list-spreadsheets" },
    {
      jobId: `fetch-googlesheets-${data.userId}-${page}`,
    }
  );
};

/**
 * Add a job to write a row to Google Sheets
 */
export const addGoogleSheetsWriteRowJob = async (
  data: Omit<GoogleSheetsWriteRowJobData, "jobType">
) => {
  const jobId = `write-row-${data.automationId}-${
    data.notionPageId
  }-${Date.now()}`;
  return googleSheetsQueue.add(
    "write-row",
    { ...data, jobType: "write-row" },
    { jobId }
  );
};

/**
 * Add a job to write headers to Google Sheets
 */
export const addGoogleSheetsWriteHeadersJob = async (
  data: Omit<GoogleSheetsWriteHeadersJobData, "jobType">
) => {
  const jobId = `write-headers-${data.automationId}-${Date.now()}`;
  return googleSheetsQueue.add(
    "write-headers",
    { ...data, jobType: "write-headers" },
    { jobId }
  );
};

/**
 * Add a job to delete a row from Google Sheets
 */
export const addGoogleSheetsDeleteRowJob = async (
  data: Omit<GoogleSheetsDeleteRowJobData, "jobType">
) => {
  const jobId = `delete-row-${data.automationId}-${
    data.notionPageId
  }-${Date.now()}`;
  return googleSheetsQueue.add(
    "delete-row",
    { ...data, jobType: "delete-row" },
    { jobId }
  );
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use addGoogleSheetsListJob instead
 */
export const addGoogleSheetsJob = async (
  data: Omit<GoogleSheetsListJobData, "jobType">
) => {
  return addGoogleSheetsListJob(data);
};

export const googleSheetsQueueEvents = new QueueEvents(
  GOOGLE_SHEETS_QUEUE_NAME,
  {
    connection,
  }
);

googleSheetsQueueEvents.on("completed", async ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed`);
  const job = await googleSheetsQueue.getJob(jobId);
  if (
    job &&
    returnvalue &&
    typeof returnvalue === "object" &&
    "nextPageToken" in returnvalue &&
    job.data.jobType === "list-spreadsheets"
  ) {
    const result = returnvalue as GoogleSheetsJobResult;
    const newData = {
      ...job.data,
      pageToken: result.nextPageToken ?? undefined,
    };
    await addGoogleSheetsListJob(newData);
  }
});

googleSheetsQueueEvents.on("failed", async ({ jobId, failedReason }) => {
  console.log(`Job ${jobId} failed`);
  console.log(`Failed reason: ${failedReason}`);
});

googleSheetsQueueEvents.on("error", async ({ message, name }) => {
  console.log(`Error with google sheets queue: ${message}`);
  console.log(`Error name: ${name}`);
});

