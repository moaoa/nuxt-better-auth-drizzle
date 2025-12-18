# Notion to Google Sheets Mapping - Overview

## Purpose and Goals

This integration enables users to synchronize data between Notion databases and Google Sheets spreadsheets. The primary use cases include:

- **Data Export**: Export Notion database contents to Google Sheets for reporting, sharing with non-Notion users, or further analysis
- **Data Backup**: Maintain a spreadsheet copy of critical Notion data
- **Workflow Integration**: Use Google Sheets as an intermediate format for connecting Notion with other tools

## Architecture Overview

The mapping system follows a queue-based architecture that leverages existing infrastructure:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Notion API    │     │    Database     │     │ Google Sheets   │
│                 │     │   (PostgreSQL)  │     │      API        │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Notion Sync    │────▶│  Mapping Layer  │────▶│  Sheets Sync    │
│    Worker       │     │  (Transform)    │     │    Worker       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                         ┌───────▼───────┐
                         │    BullMQ     │
                         │  (Redis)      │
                         └───────────────┘
```

## Data Flow

### Notion → Google Sheets Direction

1. **Fetch Phase**: `notion-sync` worker queries Notion API for database pages
2. **Store Phase**: Pages stored in `notionEntity` table with properties in `propertiesJson`
3. **Transform Phase**: Mapping layer converts Notion property types to Sheet-compatible values
4. **Write Phase**: `google-sheets` worker writes transformed rows to target spreadsheet

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Notion Sync Queue | `server/queues/notion-sync.ts` | Fetches and stores Notion entities |
| Google Sheets Queue | `server/queues/googleSheetsQueue.ts` | Manages spreadsheet operations |
| Automation Config | `db/schema.ts` → `automation` table | Links Notion DB to Google Sheet |

## Database Tables Involved

### Primary Tables

- **`notionEntity`**: Stores Notion pages and databases
  - `notionId`: Unique Notion page/database ID
  - `type`: Either "page" or "database"
  - `propertiesJson`: Full JSON of all properties
  - `accountId`: Links to user's Notion account

- **`notionDatabaseProperty`**: Stores database property definitions
  - `databaseId`: Reference to parent database
  - `propName`: Property name
  - `propType`: Property type (title, rich_text, number, etc.)
  - `valueJson`: Property configuration

- **`googleSpreadsheet`**: Stores user's Google Sheets
  - `googleSpreadsheetId`: Google's unique sheet ID
  - `title`: Spreadsheet name
  - `userId`: Owner reference

- **`automation`**: Links source and destination
  - `notionEntityId`: Source Notion database
  - `googleSpreadSheetId`: Target Google Sheet
  - `interval`: Sync frequency (5m, 15m, 30m, 1h)
  - `is_active`: Enable/disable sync

## Existing Infrastructure

### Queue Configuration

Both queues use the same Redis connection and follow similar patterns:

```typescript
const connection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
};
```

### Rate Limiting

- **Notion API**: 3 requests per second (configured in `notion-sync.ts`)
- **Google Sheets API**: 300 requests per minute (configured in `googleSheetsQueue.ts`)

## Next Steps

- [02-data-mapping.md](./02-data-mapping.md) - Property type mapping specifications
- [03-sync-strategy.md](./03-sync-strategy.md) - Sync direction and conflict handling
- [04-implementation.md](./04-implementation.md) - Code-level implementation guide



