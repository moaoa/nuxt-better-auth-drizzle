import { Queue, QueueEvents, Worker } from "bullmq";
import { BullMQOtel } from "bullmq-otel";
import { google } from "googleapis";
import { useDrizzle } from "~~/server/utils/drizzle";
import { googleSpreadsheet } from "~~/db/schema";
import { eq } from "drizzle-orm";
import winston from "winston";

const { format } = winston;

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [new winston.transports.File({ filename: "google-sheets.log" })],
});

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
};

export interface GoogleSheetsJobData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  pageToken?: string;
}

export interface GoogleSheetsJobResult {
  status: "completed" | "failed";
  message?: string;
  nextPageToken?: string | null;
}

console.log(connection);

export const GOOGLE_SHEETS_QUEUE_NAME = "google-sheets-queue";

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

export const addGoogleSheetsJob = async (data: GoogleSheetsJobData) => {
  console.log("hello from addGoogleSheetsJob");
  const page = data.pageToken || "initial";
  return googleSheetsQueue.add("process-google-sheets", data, {
    jobId: `fetch-googlesheets-${data.userId}-${page}`,
  });
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
  if (job && returnvalue) {
    const newData = { ...job.data, pageToken: returnvalue };
    await addGoogleSheetsJob(newData);
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

export const googleSheetsWorker = new Worker<
  GoogleSheetsJobData,
  GoogleSheetsJobResult
>(
  GOOGLE_SHEETS_QUEUE_NAME,
  async (job) => {
    const { userId, accessToken, refreshToken } = job.data;

    console.log(`Processing Google Sheets job for user ${userId}`);
    console.log(`Processing Google Sheets job with token ${accessToken}`);

    try {
      const db = useDrizzle();

      const drive = google.drive({ version: "v3", auth: accessToken });

      // const response = await drive.files.list({
      //   q: "mimeType='application/vnd.google-apps.spreadsheet'",
      //   // fields: "files(id,name,webViewLink),nextPageToken",
      //   access_token: accessToken,
      // });

      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: "nextPageToken,files(id,name,exportLinks)",
        access_token: accessToken,
      });

      console.log("response from google drive files: ", response);
      logger.info(response);

      const apiSpreadsheets = response.data.files || [];
      const nextPageToken = response.data.nextPageToken;

      if (apiSpreadsheets.length === 0 && !nextPageToken) {
        console.log("No spreadsheets found for user:", userId);
        // if no spreadsheets found, delete all existing ones for the user
        await db
          .delete(googleSpreadsheet)
          .where(eq(googleSpreadsheet.userId, userId));
        return {
          status: "completed",
          message: "No spreadsheets found, all existing records deleted.",
        };
      }

      const existingDBSpreadsheets = await db.query.googleSpreadsheet.findMany({
        where: eq(googleSpreadsheet.userId, userId),
      });

      const existingSheetsMap = new Map(
        existingDBSpreadsheets.map((sheet) => [
          sheet.googleSpreadsheetId,
          sheet,
        ])
      );

      const spreadsheetUpserts: (typeof googleSpreadsheet.$inferInsert)[] = [];

      for (const apiSheet of apiSpreadsheets) {
        const url =
          apiSheet["exportLinks"]?.[
            "application/x-vnd.oasis.opendocument.spreadsheet"
          ];
        if (!apiSheet.id || !apiSheet.name || !url) continue;

        const existingSheet = existingSheetsMap.get(apiSheet.id);

        spreadsheetUpserts.push({
          url,
          userId: userId,
          title: apiSheet.name,
          googleSpreadsheetId: apiSheet.id,
          updatedAt: new Date(),
          createdAt: existingSheet ? existingSheet.createdAt : new Date(),
        });
      }

      await db
        .insert(googleSpreadsheet)
        .values(spreadsheetUpserts)
        .onConflictDoUpdate({
          target: [
            googleSpreadsheet.googleSpreadsheetId,
            googleSpreadsheet.userId,
          ],
          set: {
            title: googleSpreadsheet.title,
            updatedAt: googleSpreadsheet.updatedAt,
          },
        });

      return {
        status: "completed",
        message: `Google Sheets sync completed. Added: ${spreadsheetUpserts.length}`,
        nextPageToken,
      };
    } catch (error: any) {
      console.error("Google Sheets sync failed:", error);
      throw new Error(`Google Sheets sync failed: ${error.message}`);
    }
  },
  {
    connection,
    telemetry: new BullMQOtel("google-sheets-worker"),
    limiter: {
      max: 300,
      duration: 60000,
    },
  }
);
