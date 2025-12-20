import { readRawBody } from "h3";
import { createHmac, timingSafeEqual } from "crypto";
import { useDrizzle } from "~~/server/utils/drizzle";
import { automation, notionEntity } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { notionLogger } from "~~/lib/loggers";
import { addNotionPageFetchJob } from "~~/server/queues/notion/queue";
import { addGoogleSheetsDeleteRowJob } from "~~/server/queues/google_sheets/queue";
import type {
  NotionWebhookEvent,
  NotionWebhookPayload,
} from "~~/types/webhook";
import { isEventPayload } from "~~/types/webhook";
import { NotionWebhookPayloadSchema } from "~~/types/webhook.schema";

/**
 * Validate webhook signature using HMAC-SHA256
 */
function validateSignature(
  body: string,
  signature: string,
  verificationToken: string
): boolean {
  const calculatedSignature = `sha256=${createHmac("sha256", verificationToken)
    .update(body)
    .digest("hex")}`;

  return timingSafeEqual(
    Buffer.from(calculatedSignature),
    Buffer.from(signature)
  );
}

export default defineEventHandler(async (event) => {
  try {
    // Get raw body for signature validation
    const rawBody = await readRawBody(event, "utf8").catch(() => null);
    if (!rawBody) {
      notionLogger.warn("Webhook received with empty body");
      return { status: "ok", message: "Empty body received" };
    }

    // Parse JSON body
    let parsedBody: any;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (parseError: any) {
      notionLogger.error("Failed to parse webhook JSON body", {
        error: parseError.message,
        body: rawBody.substring(0, 500), // Log first 500 chars
      });
      return {
        status: "ok",
        message: "Invalid JSON in webhook body",
        skipped: true,
        reason: "parse_error",
      };
    }

    // Validate webhook payload with Zod
    const validationResult = NotionWebhookPayloadSchema.safeParse(parsedBody);

    if (!validationResult.success) {
      const errors = validationResult.error.errors;
      notionLogger.error("Webhook payload validation failed", {
        errors: errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
          code: err.code,
        })),
        receivedPayload: parsedBody,
      });

      return {
        status: "ok",
        message: "Invalid webhook payload structure",
        skipped: true,
        reason: "validation_error",
      };
    }

    const payload: NotionWebhookPayload = validationResult.data;

    // Handle verification payload (during webhook setup)
    if (!isEventPayload(payload)) {
      notionLogger.info("Webhook verification received");
      return { status: "ok", message: "Verification received" };
    }

    const webhookEvent = payload as NotionWebhookEvent;

    // Validate signature in production
    if (process.env.NODE_ENV === "production") {
      const signature = getHeader(event, "x-notion-signature");
      const verificationToken = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;

      if (!signature || !verificationToken) {
        notionLogger.warn(
          "Missing signature or verification token in production"
        );
        return {
          status: "ok",
          message: "Invalid webhook signature",
          skipped: true,
          reason: "invalid_signature",
        };
      }

      if (!validateSignature(rawBody, signature, verificationToken)) {
        notionLogger.warn("Invalid webhook signature");
        return {
          status: "ok",
          message: "Invalid webhook signature",
          skipped: true,
          reason: "invalid_signature",
        };
      }
    }

    notionLogger.info(
      `Webhook event received: ${webhookEvent.type} for entity ${webhookEvent.entity.id}`
    );

    // Find matching automation
    let automationRecord = null;

    // For page events, check the parent database
    if (
      webhookEvent.entity.type === "page" &&
      webhookEvent.data?.parent?.type === "database" &&
      webhookEvent.data.parent.id
    ) {
      const parentDatabaseId = webhookEvent.data.parent.id;

      notionLogger.info(
        `Looking for parent database ${parentDatabaseId} for page ${webhookEvent.entity.id}`
      );

      const parentEntity = await useDrizzle().query.notionEntity.findFirst({
        where: eq(notionEntity.notionId, parentDatabaseId),
      });

      if (parentEntity) {
        automationRecord = await useDrizzle().query.automation.findFirst({
          where: eq(automation.notionEntityId, parentEntity.id),
        });

        notionLogger.info(
          `Found automation ${automationRecord?.id} for parent database ${parentDatabaseId}`
        );
      } else {
        notionLogger.warn(
          `Parent database ${parentDatabaseId} not found in notionEntity table`
        );
      }
    }

    // If not found by parent, try finding by entity itself (for database events)
    if (!automationRecord && webhookEvent.entity.type === "database") {
      const entity = await useDrizzle().query.notionEntity.findFirst({
        where: eq(notionEntity.notionId, webhookEvent.entity.id),
      });

      if (entity) {
        automationRecord = await useDrizzle().query.automation.findFirst({
          where: eq(automation.notionEntityId, entity.id),
        });
      }
    }

    // If still not found, try finding by page entity (fallback)
    if (!automationRecord && webhookEvent.entity.type === "page") {
      const entity = await useDrizzle().query.notionEntity.findFirst({
        where: eq(notionEntity.notionId, webhookEvent.entity.id),
      });

      if (entity && entity.parentId) {
        // Find automation by parent database
        const parentEntity = await useDrizzle().query.notionEntity.findFirst({
          where: eq(notionEntity.notionId, entity.parentId),
        });

        if (parentEntity) {
          automationRecord = await useDrizzle().query.automation.findFirst({
            where: eq(automation.notionEntityId, parentEntity.id),
          });
        }
      }
    }

    if (!automationRecord) {
      notionLogger.info(
        `No automation found for webhook event ${webhookEvent.id}`
      );
      return {
        status: "ok",
        skipped: true,
        reason: "not_found",
        message: "No matching automation found",
      };
    }

    // Check automation status
    if (!automationRecord.is_active) {
      notionLogger.warn(
        `Webhook received for inactive automation ${automationRecord.id}`
      );
      return {
        status: "ok",
        skipped: true,
        reason: "inactive",
        message: "Automation is inactive",
      };
    }

    // Handle different event types
    const eventType: string = webhookEvent.type;
    const entityId = webhookEvent.entity.id;

    // Handle deleted pages
    if (eventType === "page.deleted") {
      notionLogger.info(
        `Handling deleted page ${entityId} for automation ${automationRecord.id}`
      );

      // Queue Google Sheets delete job to handle deletion
      await addGoogleSheetsDeleteRowJob({
        automationId: automationRecord.id,
        notionPageId: entityId,
      });

      return {
        status: "ok",
        message: "Deletion queued",
        automationId: automationRecord.id,
      };
    }

    // For other page events, queue a job to fetch the page
    // The worker will fetch the page and then queue the mapping sync job
    if (
      eventType.startsWith("page.") &&
      eventType !== "page.deleted" &&
      webhookEvent.entity.type === "page"
    ) {
      notionLogger.info(
        `Queueing page fetch job for ${entityId} for automation ${automationRecord.id}`
      );

      // Queue Notion page fetch job
      // The worker will fetch the page and then queue the Google Sheets write job
      const job = await addNotionPageFetchJob({
        automationId: automationRecord.id,
        notionPageId: entityId,
        eventType: eventType,
      });

      notionLogger.info(
        `Queued Notion page fetch job ${job.id} for automation ${automationRecord.id}`
      );

      return {
        status: "ok",
        message: "Webhook processed successfully",
        automationId: automationRecord.id,
        jobId: job.id,
      };
    }

    // Handle database schema updates
    if (
      eventType === "database.schema_updated" ||
      eventType === "data_source.schema_updated"
    ) {
      notionLogger.info(
        `Database schema updated for ${entityId}, automation ${automationRecord.id}`
      );
      // TODO: Update mapping config if needed
      return {
        status: "ok",
        message: "Schema update logged",
        automationId: automationRecord.id,
      };
    }

    // Unsupported event type
    notionLogger.warn(
      `Unsupported webhook event type: ${eventType} for automation ${automationRecord.id}`
    );
    return {
      status: "ok",
      skipped: true,
      reason: "unsupported_event",
      message: `Event type ${eventType} not yet supported`,
    };
  } catch (error: any) {
    notionLogger.error(`Webhook processing failed: ${error.message}`, {
      error: error.stack,
    });

    return {
      status: "ok",
      message: "Webhook processing failed",
      skipped: true,
      reason: "processing_error",
    };
  }
});
