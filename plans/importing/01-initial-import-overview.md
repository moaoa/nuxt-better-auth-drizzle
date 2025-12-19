# Initial Import Overview

## Purpose

When a user creates a new automation linking a Notion database to a Google Sheet, we need to perform an initial import of existing data. This ensures that the Google Sheet is populated with the current state of the Notion database before webhook-based real-time synchronization begins.

## Goals

1. **Fetch Initial Data**: Retrieve the last 100 rows from the Notion database when automation is created
2. **Respect Rate Limits**: Calculate optimal batch size to maximize throughput without hitting Notion API rate limits (3 req/sec)
3. **Create Mapping**: Establish the link between Notion entity and Google Sheet in the `notionSheetsMapping` table
4. **Write to Google Sheets**: Queue fetched rows to Google Sheets queue for writing
5. **Create Row Mappings**: After each row is written, create a mapping record in `notionSheetsRowMapping` table
6. **UI Feedback**: Show import progress in the frontend with polling (every 10 seconds)

## Architecture Overview

```
Automation Creation
  ↓
Create notionSheetsMapping record
  ↓
Queue Initial Import Job
  ↓
Notion Import Queue (fetch pages in batches)
  ↓
Store pages in notionEntity table
  ↓
Queue Google Sheets write jobs (batch)
  ↓
Google Sheets Queue (write rows)
  ↓
Create notionSheetsRowMapping records
  ↓
Update automation status (import_complete)
```

## Key Components

1. **Initial Import Queue** (`notion-import-queue`)
   - Fetches pages from Notion database in optimal batches
   - Respects Notion API rate limits (3 req/sec)
   - Calculates maximum page size per request

2. **Mapping Creation**
   - Creates `notionSheetsMapping` record during automation creation
   - Links automation to mapping configuration

3. **Google Sheets Write Jobs**
   - Processes fetched pages through existing Google Sheets queue
   - Creates `notionSheetsRowMapping` records after successful writes

4. **Status Tracking**
   - `automation.import_status` field: `pending` | `importing` | `completed` | `failed`
   - Frontend polls every 10 seconds to check status

## Rate Limit Considerations

- **Notion API**: 3 requests per second
- **Optimal Strategy**: Fetch maximum page size (typically 100 pages per request)
- **Batch Calculation**: 
  - If max page size = 100: 1 request for 100 pages
  - If max page size = 50: 2 requests (50 + 50) with delay between
  - If max page size = 10: 10 requests with delays

## Database Schema Updates

### Automation Table
- Add `import_status` field: `pending` | `importing` | `completed` | `failed`
- Add `import_started_at` timestamp
- Add `import_completed_at` timestamp
- Add `import_total_rows` integer
- Add `import_processed_rows` integer

### Notion Sheets Mapping
- Already exists: Links automation to mapping configuration
- Created during automation creation

### Notion Sheets Row Mapping
- Already exists: Maps each Notion page to a Google Sheets row
- Created after each successful row write

## Flow Breakdown

### Phase 1: Automation Creation & Mapping Setup
- User creates automation
- Create `notionSheetsMapping` record
- Queue initial import job
- Set automation status to `importing`

### Phase 2: Notion Data Fetching
- Calculate optimal batch size
- Fetch pages from Notion database
- Store pages in `notionEntity` table
- Queue Google Sheets write jobs

### Phase 3: Google Sheets Writing
- Process write jobs through Google Sheets queue
- Write rows to Google Sheet
- Create `notionSheetsRowMapping` records
- Update automation progress

### Phase 4: Completion
- Mark automation as `completed`
- Set `import_completed_at` timestamp
- Frontend stops showing spinner

## Next Steps

See the following files for detailed implementation:
- `02-notion-fetch-and-mapping.md` - Notion fetching and mapping creation
- `03-google-sheets-write-and-row-mapping.md` - Google Sheets writing and row mapping
- `04-ui-status-tracking.md` - Frontend status polling and UI updates

