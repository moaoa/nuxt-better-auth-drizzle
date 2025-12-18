/**
 * Type definitions for Notion Webhook events
 * Based on: https://developers.notion.com/reference/webhooks
 */

/**
 * Webhook event types supported by Notion
 */
export type NotionWebhookEventType =
  | "page.created"
  | "page.content_updated"
  | "page.properties_updated"
  | "page.deleted"
  | "page.restored"
  | "page.moved"
  | "page.locked"
  | "page.unlocked"
  | "database.created"
  | "database.content_updated"
  | "database.schema_updated"
  | "database.deleted"
  | "database.restored"
  | "data_source.schema_updated"
  | "comment.created"
  | "comment.updated"
  | "comment.deleted";

/**
 * Entity types in webhook payloads
 */
export type NotionWebhookEntityType = "page" | "database" | "comment";

/**
 * Entity reference in webhook payload
 */
export interface NotionWebhookEntity {
  id: string;
  type: NotionWebhookEntityType;
}

/**
 * Workspace reference in webhook payload
 */
export interface NotionWebhookWorkspace {
  id: string;
}

/**
 * User who triggered the event
 */
export interface NotionWebhookUser {
  id: string;
  type: "person" | "bot";
}

/**
 * Parent reference for pages
 */
export interface NotionWebhookParent {
  type: "database_id" | "page_id" | "workspace" | "block_id";
  database_id?: string;
  page_id?: string;
  block_id?: string;
}

/**
 * Main webhook event payload from Notion
 */
export interface NotionWebhookEvent {
  /** Unique ID for this webhook event */
  id: string;
  /** Type of event that occurred */
  type: NotionWebhookEventType;
  /** The entity that was affected */
  entity: NotionWebhookEntity;
  /** Workspace where the event occurred */
  workspace: NotionWebhookWorkspace;
  /** Timestamp when the event occurred (ISO 8601) */
  timestamp: string;
  /** Integration ID that received the event */
  integration_id: string;
  /** User who triggered the event (if available) */
  user?: NotionWebhookUser;
  /** Parent of the entity (for pages) */
  parent?: NotionWebhookParent;
}

/**
 * Verification payload sent during webhook subscription setup
 */
export interface NotionWebhookVerification {
  verification_token: string;
}

/**
 * Union type for all possible webhook payloads
 */
export type NotionWebhookPayload = NotionWebhookEvent | NotionWebhookVerification;

/**
 * Type guard to check if payload is a verification request
 */
export function isVerificationPayload(
  payload: NotionWebhookPayload
): payload is NotionWebhookVerification {
  return "verification_token" in payload;
}

/**
 * Type guard to check if payload is an event
 */
export function isEventPayload(
  payload: NotionWebhookPayload
): payload is NotionWebhookEvent {
  return "type" in payload && "entity" in payload;
}

/**
 * Headers included in Notion webhook requests
 */
export interface NotionWebhookHeaders {
  "x-notion-signature": string;
  "content-type": "application/json";
}

/**
 * Result of processing a webhook event
 */
export interface WebhookProcessingResult {
  success: boolean;
  automationId?: number;
  jobId?: string;
  message: string;
  skipped?: boolean;
  reason?: "inactive" | "not_found" | "invalid_signature" | "unsupported_event";
}

