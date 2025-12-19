# Google Sheets Write and Row Mapping

## Overview

This document covers the implementation of writing fetched Notion pages to Google Sheets and creating row mapping records to track the relationship between Notion pages and Google Sheets rows.

## Objectives

1. Write fetched Notion pages to Google Sheets using existing Google Sheets queue
2. Create `notionSheetsRowMapping` records after successful writes
3. Track import progress and completion
4. Handle errors and retries appropriately

## Implementation Details

### 1. Google Sheets Queue Updates

**File**: `server/queues/googleSheetsQueue.ts`

The existing `write-row` job handler already supports writing rows. We need to ensure it:
- Creates `notionSheetsRowMapping` records after successful writes
- Updates automation import progress
- Marks automation as completed when all rows are written

#### Current Write-Row Handler

The existing handler already:
- Transforms Notion page data to row values
- Writes to Google Sheets (append or update)
- Creates `notionSheetsRowMapping` records

#### Updates Needed

1. **Track Import Progress**: Update automation `import_processed_rows` after each successful write
2. **Check Completion**: When all rows are written, mark automation as `completed`
3. **Handle Import Context**: Distinguish between initial import and regular webhook updates

### 2. Row Mapping Creation

The existing code already creates row mappings. We need to ensure:

```typescript
// After successful write in googleSheetsQueue.ts write-row handler
await db.insert(notionSheetsRowMapping).values({
  automationId,
  notionPageId: notionPageId,
  sheetRowNumber: rowNumber,
  checksum: newChecksum,
  lastSyncedAt: new Date(),
});
```

### 3. Import Progress Tracking

#### Update Write-Row Handler

**File**: `server/queues/googleSheetsQueue.ts`

Add import progress tracking:

```typescript
// In write-row handler, after successful write:

// Update import progress
const automationRecord = await db.query.automation.findFirst({
  where: eq(automation.id, automationId),
  columns: {
    import_status: true,
    import_total_rows: true,
    import_processed_rows: true,
  },
});

if (automationRecord?.import_status === "importing") {
  const currentProcessed = automationRecord.import_processed_rows || 0;
  const totalRows = automationRecord.import_total_rows || 0;
  const newProcessed = currentProcessed + 1;

  // Update processed count
  await db
    .update(automation)
    .set({
      import_processed_rows: newProcessed,
    })
    .where(eq(automation.id, automationId));

  // Check if import is complete
  if (newProcessed >= totalRows) {
    await db
      .update(automation)
      .set({
        import_status: "completed",
        import_completed_at: new Date(),
      })
      .where(eq(automation.id, automationId));
  }
}
```

### 4. Batch Processing Considerations

#### Sequential vs Parallel Writes

**Current Approach**: Each page is queued as a separate job
- **Pros**: Better error isolation, easier retry logic
- **Cons**: More queue overhead, slower for large batches

**Alternative Approach**: Batch multiple rows in single Google Sheets API call
- **Pros**: Faster, fewer API calls
- **Cons**: If one row fails, entire batch fails

**Recommendation**: Keep current approach (one job per row) for:
- Better error handling
- Progress tracking granularity
- Easier debugging

#### Rate Limiting

Google Sheets API rate limit: 300 requests per minute (5 req/sec)

Current queue limiter:
```typescript
limiter: {
  max: 300,
  duration: 60000, // 300 requests per minute
}
```

This is already configured correctly.

### 5. Error Handling

#### Failed Row Writes

When a row write fails:

```typescript
// In write-row handler catch block
catch (error: any) {
  // Log error but don't fail entire import
  console.error(`Failed to write row for page ${notionPageId}:`, error);
  
  // Optionally: Track failed rows in a separate table
  // For now: Job will retry automatically (3 attempts)
  
  throw error; // Let BullMQ handle retry
}
```

#### Partial Import Failures

If some rows fail after retries:
- Mark automation as `completed` with partial success
- Log failed pages for manual review
- Consider adding `import_failed_rows` count

### 6. Completion Detection

#### Method 1: Count-Based (Current)

Track `import_processed_rows` vs `import_total_rows`:
- Simple and straightforward
- Requires accurate count from Notion API

#### Method 2: Job Completion Events

Listen to queue completion events:
- More reliable for distributed systems
- Requires tracking job IDs

**Recommendation**: Use Method 1 (count-based) for simplicity, with Method 2 as fallback.

### 7. Database Updates

#### Automation Table Updates

After each successful write:

```typescript
// Increment processed count
await db
  .update(automation)
  .set({
    import_processed_rows: db.$count(automation.import_processed_rows, "+", 1),
  })
  .where(eq(automation.id, automationId));
```

On completion:

```typescript
await db
  .update(automation)
  .set({
    import_status: "completed",
    import_completed_at: new Date(),
  })
  .where(eq(automation.id, automationId));
```

### 8. Integration Flow

```
Notion Import Queue (fetches pages)
  ↓
Stores pages in notionEntity table
  ↓
Queues Google Sheets write jobs (one per page)
  ↓
Google Sheets Queue processes jobs
  ↓
For each successful write:
  1. Write row to Google Sheets
  2. Create notionSheetsRowMapping record
  3. Increment import_processed_rows
  4. Check if import_completed
     - If yes: Set import_status = "completed"
     - If no: Continue processing
```

### 9. Edge Cases

#### Empty Database
- Handle case where Notion database has 0 pages
- Mark automation as completed immediately

#### Very Large Databases (>100 pages)
- Notion import queue handles pagination
- Multiple batches are queued sequentially
- Each batch queues its own Google Sheets write jobs

#### Concurrent Writes
- Google Sheets queue limiter prevents rate limit issues
- Row mappings prevent duplicate writes

#### Failed Mapping Config
- If `notionSheetsMapping` doesn't exist, write job fails
- Automation marked as failed
- User can retry after fixing mapping config

### 10. Testing Considerations

1. **Small Database**: Test with <10 pages
2. **Medium Database**: Test with 50-100 pages
3. **Large Database**: Test with >100 pages (pagination)
4. **Error Scenarios**: Test with invalid mapping config, invalid Google Sheet ID
5. **Concurrent Imports**: Test multiple automations importing simultaneously
6. **Partial Failures**: Test behavior when some rows fail

## Next Steps

See `04-ui-status-tracking.md` for frontend implementation of status polling and UI updates.

