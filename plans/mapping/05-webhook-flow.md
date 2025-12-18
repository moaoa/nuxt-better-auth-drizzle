# Notion Webhook Sync Flow

## Overview

This document describes the real-time synchronization flow triggered by Notion webhooks. Instead of polling Notion for changes, we receive webhook events and process them through a queue-based system that respects API rate limits.

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Notion     │     │  Webhook Handler │     │    Database     │
│   Webhook    │────▶│  /api/notion/    │────▶│  Find Automation│
│              │     │  webhook.post.ts │     │                 │
└──────────────┘     └────────┬─────────┘     └─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
       ┌────────────┐  ┌────────────┐  ┌────────────┐
       │  Inactive  │  │  Notion    │  │  Sheets    │
       │  Log Only  │  │  Queue     │  │  Queue     │
       └────────────┘  │ (fetch)    │  │ (write)    │
                       └─────┬──────┘  └─────▲──────┘
                             │               │
                             └───────────────┘
                              Transform & Sync
```

## Webhook Event Types

Based on the [Notion Webhooks API](https://developers.notion.com/reference/webhooks), we handle the following events:

### Page Events
| Event | Description | Action |
|-------|-------------|--------|
| `page.created` | New page added to database | Fetch page, add row to sheet |
| `page.content_updated` | Page content changed | Fetch page, update row in sheet |
| `page.properties_updated` | Page properties changed | Fetch page, update row in sheet |
| `page.deleted` | Page moved to trash | Mark row as deleted in sheet |
| `page.restored` | Page restored from trash | Fetch page, restore row in sheet |

### Database Events
| Event | Description | Action |
|-------|-------------|--------|
| `database.schema_updated` | Database columns changed | Update mapping config |
| `data_source.schema_updated` | Data source schema changed | Update mapping config |

## Event Processing Flow

### Step 1: Receive Webhook

The endpoint `POST /api/notion/webhook.post.ts` receives the webhook payload:

```typescript
interface NotionWebhookEvent {
  id: string;                    // Unique event ID
  type: NotionWebhookEventType;  // e.g., "page.content_updated"
  entity: {
    id: string;                  // Page or database ID
    type: "page" | "database";
  };
  workspace: { id: string };
  timestamp: string;             // ISO 8601
  parent?: {
    type: "database_id" | "page_id";
    database_id?: string;
  };
}
```

### Step 2: Validate Signature (Production)

Verify the `X-Notion-Signature` header using HMAC-SHA256:

```typescript
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
```

### Step 3: Find Matching Automation

Query the database to find an automation that tracks the affected entity:

```typescript
// For page events, check the parent database
if (parent?.database_id) {
  const parentEntity = await db.query.notionEntity.findFirst({
    where: eq(notionEntity.notionId, parent.database_id),
  });
  // Find automation by notionEntityId
}

// Or find by the entity itself
const entity = await db.query.notionEntity.findFirst({
  where: eq(notionEntity.notionId, entityId),
});
```

### Step 4: Check Automation Status

```typescript
if (!automationRecord.is_active) {
  notionLogger.warn(
    `Webhook received for inactive automation ${automationRecord.id}`
  );
  return { status: "ok", skipped: true, reason: "inactive" };
}
```

### Step 5: Queue Notion Fetch Job

Add a job to the `notion-page-fetch` queue to fetch the page data:

```typescript
await addNotionPageFetchJob({
  automationId: automationRecord.id,
  notionPageId: entity.id,
  eventType: payload.type,
});
```

The queue respects Notion's rate limit of **3 requests per second**.

### Step 6: Process in Notion Queue

The `notionPageFetchWorker` fetches the page and stores it in the database:

```typescript
const page = await notion.pages.retrieve({ page_id: notionPageId });

await db
  .insert(notionEntity)
  .values(entityValue)
  .onConflictDoUpdate({
    target: notionEntity.notionId,
    set: { /* updated fields */ },
  });
```

### Step 7: Queue Sheets Write Job

After fetching, queue a job to write to Google Sheets:

```typescript
await addMappingSyncJob({
  automationId,
  syncType: "incremental",
  pageId: notionPageId,
});
```

The queue respects Google Sheets' rate limit of **300 requests per minute**.

### Step 8: Write to Google Sheets

The `mappingSyncWorker` transforms the data and writes to the sheet:

```typescript
// Transform Notion properties to row values
const rowValues = transformPageToRow(pageData, mappingConfig.columns);

// Update or append row
if (existingMapping) {
  await sheets.spreadsheets.values.update({...});
} else {
  await sheets.spreadsheets.values.append({...});
}
```

## Database Tables

### notionWebhookSubscription

Stores webhook configuration per automation:

```typescript
notionWebhookSubscription: {
  id: serial,
  automationId: FK -> automation.id (unique),
  verificationToken: text,        // For signature validation
  eventTypes: jsonb,              // ["page.content_updated", ...]
  isVerified: boolean,
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

### notionSheetsRowMapping

Tracks which Notion pages map to which Sheet rows:

```typescript
notionSheetsRowMapping: {
  id: serial,
  automationId: FK -> automation.id,
  notionPageId: uuid,
  sheetRowNumber: integer,
  checksum: text,                 // For change detection
  lastSyncedAt: timestamp,
}
```

## Queue Configuration

### Notion Page Fetch Queue

```typescript
// File: server/queues/notion-sync.ts
export const notionPageFetchQueue = new Queue("notion-page-fetch", {
  connection,
  telemetry: new BullMQOtel("notion-page-fetch-queue"),
});

// Worker with rate limiting
export const notionPageFetchWorker = new Worker(
  "notion-page-fetch",
  async (job) => { /* ... */ },
  {
    connection,
    limiter: {
      max: 3,
      duration: 1000, // 3 requests per second
    },
  }
);
```

### Mapping Sync Queue

```typescript
// File: server/queues/mappingSyncQueue.ts
export const mappingSyncQueue = new Queue("mapping-sync-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  },
});

// Worker with rate limiting
export const mappingSyncWorker = new Worker(
  "mapping-sync-queue",
  async (job) => { /* ... */ },
  {
    connection,
    limiter: {
      max: 300,
      duration: 60000, // 300 requests per minute
    },
  }
);
```

## Logging

All webhook events are logged using the Notion logger:

```typescript
// Inactive automation
notionLogger.warn(
  `Webhook received for inactive automation ${automationId}`
);

// Successful processing
notionLogger.info(
  `Queued Notion fetch job ${job.id} for automation ${automationId}`
);

// Errors
notionLogger.error(`Page fetch failed: ${error.message}`);
```

Log files are stored in `logs/` directory.

## Error Handling

### Retry Strategy

Jobs automatically retry with exponential backoff:

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000, // 1s, 2s, 4s
  },
}
```

### Error Scenarios

| Error | Handling |
|-------|----------|
| Invalid signature | Return 401, log warning |
| Automation not found | Return 200 OK, log info |
| Automation inactive | Return 200 OK, log warning |
| Notion API error | Retry with backoff |
| Google Sheets API error | Retry with backoff |
| Rate limit exceeded | Queue handles automatically |

## Webhook Setup in Notion

To receive webhooks, configure them in the Notion integration settings:

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Select your integration
3. Navigate to **Webhooks** tab
4. Click **+ Create a subscription**
5. Enter your webhook URL: `https://your-domain.com/api/notion/webhook`
6. Select event types to subscribe to
7. Complete verification by pasting the `verification_token`

## Files Reference

| File | Purpose |
|------|---------|
| `types/webhook.ts` | Webhook payload type definitions |
| `db/schema.ts` | Database schema including `notionWebhookSubscription` |
| `server/api/notion/webhook.post.ts` | Webhook endpoint handler |
| `server/queues/notion-sync.ts` | Notion page fetch queue and worker |
| `server/queues/mappingSyncQueue.ts` | Google Sheets sync queue and worker |
| `server/services/propertyTransformer.ts` | Notion property to Sheets value transformer |
| `lib/loggers/notion.ts` | Notion-specific logging |

