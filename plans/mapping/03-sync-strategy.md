# Notion to Google Sheets - Sync Strategy

## Sync Direction Options

### Option 1: Notion → Sheets (One-Way)

**Use Case**: Export/backup Notion data to Sheets

```
┌─────────────┐         ┌─────────────┐
│   Notion    │ ──────▶ │   Sheets    │
│  (Source)   │         │  (Target)   │
└─────────────┘         └─────────────┘
```

**Characteristics**:
- Notion is the source of truth
- Sheet data can be overwritten without conflict
- Simpler implementation
- Recommended for initial implementation

### Option 2: Sheets → Notion (One-Way)

**Use Case**: Import spreadsheet data into Notion

```
┌─────────────┐         ┌─────────────┐
│   Sheets    │ ──────▶ │   Notion    │
│  (Source)   │         │  (Target)   │
└─────────────┘         └─────────────┘
```

**Characteristics**:
- Sheets is the source of truth
- Requires property type inference or mapping
- More complex (need to create Notion pages)

### Option 3: Bidirectional Sync

**Use Case**: Keep both systems in sync

```
┌─────────────┐         ┌─────────────┐
│   Notion    │ ◀─────▶ │   Sheets    │
│             │         │             │
└─────────────┘         └─────────────┘
```

**Characteristics**:
- Requires conflict resolution
- Most complex implementation
- Needs change tracking on both sides

## Row Identification Strategy

### Primary Key: Notion Page ID

Each Notion page has a unique UUID. This ID serves as the row identifier:

```typescript
interface RowIdentifier {
  notionPageId: string;      // UUID from Notion
  sheetRowNumber: number;    // 1-based row in sheet
  lastSyncedAt: Date;        // Timestamp of last sync
  checksum: string;          // Hash of row data for change detection
}
```

### Sheet Row Mapping Table

Store the mapping between Notion pages and Sheet rows:

```sql
CREATE TABLE notion_sheets_row_mapping (
  id SERIAL PRIMARY KEY,
  automation_id INTEGER REFERENCES automation(id),
  notion_page_id UUID NOT NULL,
  sheet_row_number INTEGER NOT NULL,
  checksum VARCHAR(64),
  last_synced_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(automation_id, notion_page_id)
);
```

### Finding Rows

```typescript
async function findSheetRow(
  automationId: number,
  notionPageId: string
): Promise<number | null> {
  const mapping = await db.query.notionSheetsRowMapping.findFirst({
    where: and(
      eq(notionSheetsRowMapping.automationId, automationId),
      eq(notionSheetsRowMapping.notionPageId, notionPageId)
    )
  });
  return mapping?.sheetRowNumber ?? null;
}
```

## Sync Operations

### Full Sync

Rebuilds the entire sheet from Notion data:

```typescript
async function fullSync(automation: Automation): Promise<void> {
  // 1. Clear existing sheet data (keep headers)
  await clearSheetData(automation.googleSpreadSheetId, startRow: 2);
  
  // 2. Clear row mappings
  await clearRowMappings(automation.id);
  
  // 3. Fetch all pages from Notion database
  const pages = await fetchAllNotionPages(automation.notionEntityId);
  
  // 4. Transform and write to sheet
  const rows = pages.map(transformPageToRow);
  await writeRowsToSheet(automation.googleSpreadSheetId, rows);
  
  // 5. Create new row mappings
  await createRowMappings(automation.id, pages);
}
```

### Incremental Sync

Only syncs changes since last sync:

```typescript
async function incrementalSync(automation: Automation): Promise<void> {
  const lastSyncTime = automation.last_synced_at;
  
  // 1. Fetch pages modified since last sync
  const modifiedPages = await fetchModifiedPages(
    automation.notionEntityId,
    lastSyncTime
  );
  
  // 2. Process each modified page
  for (const page of modifiedPages) {
    const existingRow = await findSheetRow(automation.id, page.id);
    
    if (existingRow) {
      // Update existing row
      await updateSheetRow(automation.googleSpreadSheetId, existingRow, page);
    } else {
      // Append new row
      const newRowNumber = await appendSheetRow(automation.googleSpreadSheetId, page);
      await createRowMapping(automation.id, page.id, newRowNumber);
    }
  }
  
  // 3. Handle deleted pages
  await handleDeletedPages(automation);
}
```

### Delete Detection

```typescript
async function handleDeletedPages(automation: Automation): Promise<void> {
  // Get all mapped Notion page IDs
  const mappedIds = await getMappedPageIds(automation.id);
  
  // Check which pages still exist in Notion
  const existingIds = await getExistingNotionPageIds(
    automation.notionEntityId,
    mappedIds
  );
  
  // Find deleted pages
  const deletedIds = mappedIds.filter(id => !existingIds.includes(id));
  
  // Remove rows for deleted pages
  for (const pageId of deletedIds) {
    const rowNumber = await findSheetRow(automation.id, pageId);
    if (rowNumber) {
      await deleteSheetRow(automation.googleSpreadSheetId, rowNumber);
      await deleteRowMapping(automation.id, pageId);
    }
  }
}
```

## Conflict Resolution

### Last-Write-Wins (Simple)

For Notion → Sheets sync, the latest Notion state always wins:

```typescript
type ConflictStrategy = 'notion_wins' | 'sheets_wins' | 'manual';

async function resolveConflict(
  notionData: PageData,
  sheetsData: RowData,
  strategy: ConflictStrategy
): Promise<RowData> {
  switch (strategy) {
    case 'notion_wins':
      return transformPageToRow(notionData);
    case 'sheets_wins':
      return sheetsData;
    case 'manual':
      throw new ConflictError(notionData, sheetsData);
  }
}
```

### Change Detection with Checksums

Detect if a row has actually changed:

```typescript
import { createHash } from 'crypto';

function computeRowChecksum(row: RowData): string {
  const normalized = JSON.stringify(row, Object.keys(row).sort());
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

async function hasRowChanged(
  automationId: number,
  pageId: string,
  newRow: RowData
): Promise<boolean> {
  const mapping = await findRowMapping(automationId, pageId);
  if (!mapping) return true;
  
  const newChecksum = computeRowChecksum(newRow);
  return mapping.checksum !== newChecksum;
}
```

## Rate Limiting Considerations

### Notion API Limits

- **Rate**: 3 requests per second
- **Handling**: Built into existing worker via BullMQ limiter

```typescript
// From notion-sync.ts
limiter: {
  max: 3,
  duration: 1000, // 3 jobs per second
}
```

### Google Sheets API Limits

- **Rate**: 300 requests per minute
- **Handling**: Built into existing worker

```typescript
// From googleSheetsQueue.ts
limiter: {
  max: 300,
  duration: 60000,
}
```

### Batch Operations

Reduce API calls by batching:

```typescript
// Instead of updating one cell at a time
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId,
  requestBody: {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Sheet1!A2:Z2', values: [row1] },
      { range: 'Sheet1!A3:Z3', values: [row2] },
      // ... more rows
    ]
  }
});
```

## Sync Scheduling

### Interval Options

From the `automation` schema:

```typescript
interval: text("interval", { enum: ["5m", "15m", "30m", "1h"] })
```

### Cron-Based Scheduling

```typescript
const intervalToCron: Record<string, string> = {
  '5m': '*/5 * * * *',
  '15m': '*/15 * * * *',
  '30m': '*/30 * * * *',
  '1h': '0 * * * *',
};

function scheduleSync(automation: Automation): void {
  const cronExpression = intervalToCron[automation.interval];
  
  cron.schedule(cronExpression, async () => {
    if (automation.is_active) {
      await addMappingSyncJob({
        automationId: automation.id,
        syncType: 'incremental'
      });
    }
  });
}
```

## Error Handling

### Retry Strategy

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,  // 1s, 2s, 4s
  },
}
```

### Error Categories

| Error Type | Handling |
|------------|----------|
| Rate limit exceeded | Automatic retry with backoff |
| Invalid credentials | Mark automation as inactive, notify user |
| Sheet not found | Log error, skip sync |
| Notion page deleted | Remove from mapping |
| Network timeout | Retry |

## Next Steps

- [04-implementation.md](./04-implementation.md) - Code-level implementation guide



