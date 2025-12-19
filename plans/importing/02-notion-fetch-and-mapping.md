# Notion Fetch and Mapping Creation

## Overview

This document covers the implementation of fetching initial data from Notion databases and creating the mapping configuration between Notion and Google Sheets.

## Objectives

1. Create `notionSheetsMapping` record when automation is created
2. Calculate optimal batch size for Notion API requests
3. Fetch last 100 pages from Notion database
4. Store fetched pages in `notionEntity` table
5. Queue Google Sheets write jobs for fetched pages

## Implementation Details

### 1. Database Schema Updates

#### Automation Table
Add the following fields to track import status:

```typescript
import_status: text("import_status")
  .default("pending")
  .notNull(), // 'pending' | 'importing' | 'completed' | 'failed'
import_started_at: timestamp("import_started_at"),
import_completed_at: timestamp("import_completed_at"),
import_total_rows: integer("import_total_rows"),
import_processed_rows: integer("import_processed_rows").default(0),
```

### 2. Automation Creation Endpoint Updates

**File**: `server/api/automations/index.post.ts`

After creating the automation record:

```typescript
// 1. Create notionSheetsMapping record
const mappingConfig: MappingConfig = {
  automationId: newAutomation[0].id,
  headerRow: 1,
  dataStartRow: 2,
  columns: [], // Will be populated later or from user input
  includeNotionId: true,
  includeLastSync: false,
  sheetName: "Sheet1", // Default or from config
};

await db.insert(notionSheetsMapping).values({
  automationId: newAutomation[0].id,
  mappingConfig: mappingConfig,
});

// 2. Queue initial import job
await addNotionImportJob({
  automationId: newAutomation[0].id,
  notionDatabaseId: _notionEntity.notionId,
});

// 3. Update automation status
await db
  .update(automation)
  .set({
    import_status: "importing",
    import_started_at: new Date(),
  })
  .where(eq(automation.id, newAutomation[0].id));
```

### 3. Notion Import Queue

**File**: `server/queues/notion-import.ts` (new file)

#### Queue Configuration

```typescript
export const NOTION_IMPORT_QUEUE_NAME = "notion-import-queue";

export const notionImportQueue = new Queue(NOTION_IMPORT_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
  telemetry: new BullMQOtel("notion-import-queue"),
});
```

#### Job Data Interface

```typescript
export interface NotionImportJobData {
  automationId: number;
  notionDatabaseId: string;
  cursor?: string; // For pagination
  pageSize?: number; // Override default page size
}
```

#### Rate Limit Calculator

```typescript
/**
 * Calculate optimal page size for Notion API requests
 * Notion API limit: 3 requests per second
 * Maximum page size: 100 pages per request (Notion API limit)
 * 
 * Strategy: Use maximum page size (100) to minimize requests
 */
function calculateOptimalPageSize(): number {
  // Notion API allows up to 100 pages per request
  const MAX_PAGE_SIZE = 100;
  return MAX_PAGE_SIZE;
}

/**
 * Calculate delay between requests to respect rate limits
 * Notion API: 3 requests per second = 333ms between requests
 */
function calculateRequestDelay(): number {
  const REQUESTS_PER_SECOND = 3;
  return Math.ceil(1000 / REQUESTS_PER_SECOND); // 334ms
}
```

#### Worker Implementation

```typescript
export const notionImportWorker = new Worker<
  NotionImportJobData,
  NotionImportJobResult
>(
  NOTION_IMPORT_QUEUE_NAME,
  async (job) => {
    const { automationId, notionDatabaseId, cursor, pageSize } = job.data;
    const db = useDrizzle();

    try {
      // 1. Get automation and Notion account
      const automationRecord = await db.query.automation.findFirst({
        where: eq(automation.id, automationId),
        with: {
          notionAccount: true,
        },
      });

      if (!automationRecord || !automationRecord.notionAccountId) {
        throw new Error(`Automation ${automationId} not found`);
      }

      // 2. Initialize Notion client
      const notion = new Client({
        auth: automationRecord.notionAccount.access_token,
      });

      // 3. Calculate optimal page size
      const optimalPageSize = pageSize || calculateOptimalPageSize();
      const requestDelay = calculateRequestDelay();

      // 4. Query Notion database
      const response = await notion.databases.query({
        database_id: notionDatabaseId,
        page_size: optimalPageSize,
        start_cursor: cursor,
        sorts: [
          {
            timestamp: "last_edited_time",
            direction: "descending", // Get most recently edited pages first
          },
        ],
      });

      const pages = response.results as PageObjectResponse[];
      
      // 5. Store pages in notionEntity table
      if (pages.length > 0) {
        const entities: Omit<NotionEntity, "id">[] = pages.map((page) => ({
          notionId: page.id,
          parentId: notionDatabaseId,
          type: "page",
          accountId: automationRecord.notionAccountId!,
          archived: page.archived,
          titlePlain: getTitle(page),
          createdTime: new Date(page.created_time),
          lastEditedTime: new Date(page.last_edited_time),
          workspaceId: automationRecord.notionAccount.workspace_id,
          propertiesJson: page,
          user_id: automationRecord.user_id,
        }));

        await db
          .insert(notionEntity)
          .values(entities)
          .onConflictDoUpdate({
            target: notionEntity.notionId,
            set: {
              parentId: notionDatabaseId,
              titlePlain: notionEntity.titlePlain,
              archived: notionEntity.archived,
              lastEditedTime: notionEntity.lastEditedTime,
              propertiesJson: notionEntity.propertiesJson,
            },
          });

        // 6. Queue Google Sheets write jobs for fetched pages
        for (const page of pages) {
          await addGoogleSheetsWriteRowJob({
            automationId,
            notionPageId: page.id,
            eventType: "page.created", // Treat as new rows for initial import
          });
        }

        // 7. Update automation progress
        const currentProcessed = automationRecord.import_processed_rows || 0;
        await db
          .update(automation)
          .set({
            import_processed_rows: currentProcessed + pages.length,
            import_total_rows: response.total_rows || pages.length,
          })
          .where(eq(automation.id, automationId));

        // 8. If there are more pages, queue next batch
        if (response.has_more && response.next_cursor) {
          // Add delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, requestDelay));
          
          await addNotionImportJob({
            automationId,
            notionDatabaseId,
            cursor: response.next_cursor,
            pageSize: optimalPageSize,
          });
        } else {
          // Import complete - status will be updated by Google Sheets queue
          // when all rows are written
        }
      }

      return {
        status: "completed",
        pagesFetched: pages.length,
        hasMore: response.has_more || false,
        nextCursor: response.next_cursor || null,
      };
    } catch (error: any) {
      // Update automation status to failed
      await db
        .update(automation)
        .set({
          import_status: "failed",
        })
        .where(eq(automation.id, automationId));

      throw new Error(`Notion import failed: ${error.message}`);
    }
  },
  {
    connection,
    telemetry: new BullMQOtel("notion-import-worker"),
    limiter: {
      max: 3,
      duration: 1000, // 3 requests per second (Notion rate limit)
    },
  }
);
```

#### Helper Functions

```typescript
/**
 * Add a Notion import job to the queue
 */
export const addNotionImportJob = async (data: NotionImportJobData) => {
  const jobId = `notion-import-${data.automationId}-${data.cursor || "initial"}-${Date.now()}`;
  return notionImportQueue.add("import-notion-database", data, { jobId });
};
```

### 4. Integration Points

#### Update Automation Creation Endpoint

After creating automation, trigger initial import:

```typescript
// In server/api/automations/index.post.ts
import { addNotionImportJob } from "~~/server/queues/notion-import";

// After creating automation and mapping...
await addNotionImportJob({
  automationId: newAutomation[0].id,
  notionDatabaseId: _notionEntity.notionId,
});
```

### 5. Error Handling

- **Rate Limit Errors**: Worker respects rate limits with limiter configuration
- **API Errors**: Retry with exponential backoff (3 attempts)
- **Database Errors**: Rollback and mark automation as failed
- **Partial Failures**: Continue processing remaining pages

### 6. Testing Considerations

1. **Rate Limit Testing**: Verify that requests don't exceed 3 req/sec
2. **Large Database Testing**: Test with databases containing >100 pages
3. **Error Recovery**: Test behavior when Notion API is unavailable
4. **Concurrent Imports**: Test multiple automations importing simultaneously

## Next Steps

See `03-google-sheets-write-and-row-mapping.md` for how fetched pages are written to Google Sheets and row mappings are created.

