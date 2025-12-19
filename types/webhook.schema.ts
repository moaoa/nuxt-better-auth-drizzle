import { z } from "zod";

/**
 * Zod schema for Notion Webhook validation
 */

const NotionWebhookEventTypeSchema = z.enum([
  "page.created",
  "page.content_updated",
  "page.properties_updated",
  "page.deleted",
  "page.restored",
  "page.moved",
  "page.locked",
  "page.unlocked",
  "database.created",
  "database.content_updated",
  "database.schema_updated",
  "database.deleted",
  "database.restored",
  "data_source.schema_updated",
  "comment.created",
  "comment.updated",
  "comment.deleted",
]);

const NotionWebhookEntityTypeSchema = z.enum(["page", "database", "comment"]);

const NotionWebhookUserSchema = z.object({
  id: z.string(),
  type: z.enum(["person", "bot"]),
});

const NotionWebhookParentSchema = z.object({
  id: z.string(),
  type: z.enum(["database", "page", "workspace", "block"]),
  data_source_id: z.string().optional(),
});

const NotionWebhookEventDataSchema = z.object({
  parent: NotionWebhookParentSchema.optional(),
}).passthrough(); // Allow additional fields

const NotionWebhookEntitySchema = z.object({
  id: z.string(),
  type: NotionWebhookEntityTypeSchema,
});

const NotionWebhookEventSchema = z.object({
  id: z.string(),
  type: NotionWebhookEventTypeSchema,
  entity: NotionWebhookEntitySchema,
  workspace_id: z.string(),
  workspace_name: z.string().optional(),
  timestamp: z.string(),
  integration_id: z.string(),
  subscription_id: z.string().optional(),
  authors: z.array(NotionWebhookUserSchema).optional(),
  accessible_by: z.array(NotionWebhookUserSchema).optional(),
  attempt_number: z.number().optional(),
  api_version: z.string().optional(),
  data: NotionWebhookEventDataSchema.optional(),
});

const NotionWebhookVerificationSchema = z.object({
  verification_token: z.string(),
});

const NotionWebhookPayloadSchema = z.union([
  NotionWebhookEventSchema,
  NotionWebhookVerificationSchema,
]);

export {
  NotionWebhookEventTypeSchema,
  NotionWebhookEntityTypeSchema,
  NotionWebhookUserSchema,
  NotionWebhookParentSchema,
  NotionWebhookEventDataSchema,
  NotionWebhookEntitySchema,
  NotionWebhookEventSchema,
  NotionWebhookVerificationSchema,
  NotionWebhookPayloadSchema,
};


