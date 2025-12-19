# Automation Creation and Deletion Plan

## Overview

This document describes the implementation plan for creating and deleting Notion to Google Sheets automations through the UI, including the data flow between frontend and backend.

## Current State Analysis

### Frontend (`app/pages/app/services/connect/google-sheets.vue`)

**Current Flow:**

1. Step 1: Connect Notion (`NotionConnectStep`) - Collects `notionAccountId` (UUID)
2. Step 2: Connect Google Sheets (`GoogleSheetsConnectStep`) - Collects `googleSheetsAccountId` (UUID)
3. Step 3: Select Database (`ChooseDirectionStep`) - Collects database selection

**Current Issues:**

- `saveServiceMutation` is a TODO - not implemented
- Data collected in stepper components is not being sent to backend
- Missing: Google Sheet selection/creation
- Missing: Notion Entity ID resolution
- Missing: Proper data transformation before sending to backend

### Backend (`server/api/automations/index.post.ts`)

**Expected Payload:**

```typescript
{
  type: "notion_db_to_google_sheet",
  googleSheetId: string,              // Google Spreadsheet ID (UUID)
  notionEntityId: string,              // Notion Entity UUID
  googleSheetsAccountId: string,       // Google Sheets Account UUID
  notionAccountId: string,             // Notion Account UUID
  config: {
    createNewGoogleSheet: boolean,
    createNewNotionDb: boolean
  }
}
```

**Backend Processing:**

- Validates payload with Zod schema
- Finds `automationType` by `automationTypeKey`
- Finds `googleSheetsAccount` by `googleSheetsId` (UUID) and `user_id`
- Finds `notionAccount` by `uuid` and `user_id`
- **MISSING**: Finds `notionEntity` by `notionId` (UUID)
- **MISSING**: Finds `googleSpreadsheet` by `googleSpreadsheetId` (UUID)
- Creates automation with:
  - `is_active: true` ✅ (already default)
  - `interval: "5m"` (hardcoded)
  - Missing: `notionEntityId` (integer FK)
  - Missing: `googleSpreadSheetId` (integer FK)

## Required Changes

### 1. Backend Updates (`server/api/automations/index.post.ts`)

#### 1.1 Add Notion Entity Resolution

```typescript
// After finding notionAccount, add:
const _notionEntity = await db.query.notionEntity.findFirst({
  where: and(
    eq(notionEntity.notionId, notionEntityId), // UUID from payload
    eq(notionEntity.accountId, _notionAccount.id) // Ensure it belongs to the account
  ),
});

if (!_notionEntity) {
  throw createError({
    statusCode: 404,
    message: "Notion entity not found.",
  });
}

// Verify it's a database type
if (_notionEntity.type !== "database") {
  throw createError({
    statusCode: 400,
    message: "Selected entity must be a database.",
  });
}
```

#### 1.2 Add Google Spreadsheet Resolution

```typescript
// After finding googleSheetsAccount, add:
const _googleSpreadsheet = await db.query.googleSpreadsheet.findFirst({
  where: and(
    eq(googleSpreadsheet.googleSpreadsheetId, googleSheetId), // UUID from payload
    eq(googleSpreadsheet.user_id, session!.user.id) // Ensure it belongs to the user
  ),
});

if (!_googleSpreadsheet) {
  throw createError({
    statusCode: 404,
    message: "Google Spreadsheet not found.",
  });
}
```

#### 1.3 Update Automation Creation

```typescript
const newAutomation = await db
  .insert(automation)
  .values({
    uuid: crypto.randomUUID(),
    name: "Notion db to google sheets",
    user_id: session!.user.id,
    automationTypeId: _automationType.id,
    is_active: true, // ✅ Already default
    interval: "5m",
    googleSheetsAccountId: _googleSheetsAccount.id, // integer FK
    notionAccountId: _notionAccount.id, // integer FK
    notionEntityId: _notionEntity.id, // integer FK - ADD THIS
    googleSpreadSheetId: _googleSpreadsheet.id, // integer FK - ADD THIS
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  .returning();
```

### 2. Frontend Updates

#### 2.1 Update `google-sheets.vue` - Collect All Required Data

**Add state management:**

```typescript
const selectedNotionAccountId = ref<string | null>(null);
const selectedGoogleSheetsAccountId = ref<string | null>(null);
const selectedNotionEntityId = ref<string | null>(null); // Database UUID
const selectedGoogleSheetId = ref<string | null>(null); // Spreadsheet UUID
const createNewGoogleSheet = ref(false);
const newGoogleSheetName = ref("");
```

**Update stepper event handlers:**

```typescript
// Handle account selections from stepper components
const onNotionAccountSelected = (accountId: string) => {
  selectedNotionAccountId.value = accountId;
};

const onGoogleSheetsAccountSelected = (accountId: string) => {
  selectedGoogleSheetsAccountId.value = accountId;
};

// Handle database selection from ChooseDirectionStep
const onDatabaseSelected = (data: {
  notionEntityId: string;
  googleSheetId?: string;
  createNewSheet?: boolean;
  newSheetName?: string;
}) => {
  selectedNotionEntityId.value = data.notionEntityId;
  if (data.createNewSheet) {
    createNewGoogleSheet.value = true;
    newGoogleSheetName.value = data.newSheetName || "";
  } else {
    createNewGoogleSheet.value = false;
    selectedGoogleSheetId.value = data.googleSheetId || null;
  }
};
```

#### 2.2 Implement `saveServiceMutation`

```typescript
const saveServiceMutation = useMutation({
  mutationFn: async () => {
    if (
      !selectedNotionAccountId.value ||
      !selectedGoogleSheetsAccountId.value ||
      !selectedNotionEntityId.value
    ) {
      throw new Error("Missing required selections");
    }

    if (!createNewGoogleSheet.value && !selectedGoogleSheetId.value) {
      throw new Error("Please select a Google Sheet or create a new one");
    }

    const payload = {
      type: "notion_db_to_google_sheet" as const,
      notionEntityId: selectedNotionEntityId.value,
      notionAccountId: selectedNotionAccountId.value,
      googleSheetsAccountId: selectedGoogleSheetsAccountId.value,
      googleSheetId: selectedGoogleSheetId.value || "", // Will be created if new
      config: {
        createNewGoogleSheet: createNewGoogleSheet.value,
        createNewNotionDb: false, // Not supported yet
      },
    };

    const response = await $fetch("/api/automations", {
      method: "POST",
      body: payload,
    });

    return response;
  },
  onSuccess: () => {
    // Invalidate queries
    // Navigate to automations list or show success message
    navigateTo("/app/automations");
  },
  onError: (error) => {
    console.error("Failed to create automation:", error);
    // Show error toast/notification
  },
});
```

#### 2.3 Update `ChooseDirectionStep` Component

**Add Google Sheet selection:**

- Add UI to select existing Google Sheet (similar to Notion database selection)
- Add toggle/switch for "Create New Google Sheet"
- Add input field for new sheet name (when creating new)
- Emit event with all collected data:
  ```typescript
  emit("database-selected", {
    notionEntityId: selectedDatabaseUuid,
    googleSheetId: selectedSheetId,
    createNewSheet: createNewSheet.value,
    newSheetName: newSheetName.value,
  });
  ```

#### 2.4 Update Stepper Component Props/Events

**Update `GoogleSheetsStepper` to pass through events:**

```vue
<NotionConnectStep
  :notion-accounts-options="notionAccountsOptions"
  @account-selected="onNotionAccountSelected"
/>

<GoogleSheetsConnectStep
  :google-sheets-accounts-options="googleSheetsAccountsOptions"
  @account-selected="onGoogleSheetsAccountSelected"
/>

<ChooseDirectionStep @database-selected="onDatabaseSelected" />
```

### 3. Delete Automation Feature

#### 3.1 Backend Endpoint (`server/api/automations/[uuid].delete.ts`)

**Create new file:**

```typescript
import { auth } from "~~/lib/auth";
import { useDrizzle } from "~~/server/utils/drizzle";
import { automation } from "~~/db/schema";
import { eq, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  const automationUuid = getRouterParam(event, "uuid");

  if (!automationUuid) {
    throw createError({
      statusCode: 400,
      message: "Automation UUID is required",
    });
  }

  const db = useDrizzle();

  // Find automation and verify ownership
  const automationRecord = await db.query.automation.findFirst({
    where: and(
      eq(automation.uuid, automationUuid),
      eq(automation.user_id, session!.user.id)
    ),
  });

  if (!automationRecord) {
    throw createError({
      statusCode: 404,
      message: "Automation not found",
    });
  }

  // Delete automation (cascade will handle related records)
  await db.delete(automation).where(eq(automation.uuid, automationUuid));

  return {
    success: true,
    message: "Automation deleted successfully",
  };
});
```

#### 3.2 Frontend Delete Button (`app/pages/app/automations/index.vue`)

**Update the Delete menu item:**

```vue
<DropdownMenuItem
  @click="handleDelete(automation.uuid)"
  class="text-destructive"
>
  Delete
</DropdownMenuItem>
```

**Add delete handler:**

```typescript
const queryClient = useQueryClient();

const deleteMutation = useMutation({
  mutationFn: async (automationUuid: string) => {
    // Delete using UUID directly
    await $fetch(`/api/automations/${automationUuid}`, {
      method: "DELETE",
    });
  },
  onSuccess: () => {
    // Invalidate and refetch automations list
    queryClient.invalidateQueries({ queryKey: ["automations"] });
    // Show success toast
  },
  onError: (error) => {
    console.error("Failed to delete automation:", error);
    // Show error toast
  },
});

const handleDelete = (automationUuid: string) => {
  if (confirm("Are you sure you want to delete this automation?")) {
    deleteMutation.mutate(automationUuid);
  }
};
```

## Data Flow Diagram

```
Frontend (google-sheets.vue)
  ↓
Step 1: NotionConnectStep
  → selectedNotionAccountId (UUID)
  ↓
Step 2: GoogleSheetsConnectStep
  → selectedGoogleSheetsAccountId (UUID)
  ↓
Step 3: ChooseDirectionStep
  → selectedNotionEntityId (UUID)
  → selectedGoogleSheetId (UUID) OR createNewGoogleSheet + name
  ↓
saveServiceMutation
  → POST /api/automations
  → Payload: { type, notionEntityId, notionAccountId, googleSheetsAccountId, googleSheetId, config }
  ↓
Backend (index.post.ts)
  → Find automationType by type
  → Find notionAccount by uuid + user_id → get integer ID
  → Find googleSheetsAccount by googleSheetsId + user_id → get integer ID
  → Find notionEntity by notionId + accountId → get integer ID
  → Find googleSpreadsheet by googleSpreadsheetId + user_id → get integer ID
  → Create automation with all integer FKs
  ↓
Return created automation
```

## Implementation Checklist

### Backend

- [ ] Update `index.post.ts` to resolve `notionEntity` by UUID
- [ ] Update `index.post.ts` to resolve `googleSpreadsheet` by UUID
- [ ] Update `index.post.ts` to set `notionEntityId` FK
- [ ] Update `index.post.ts` to set `googleSpreadSheetId` FK
- [ ] Create `[uuid].delete.ts` endpoint
- [ ] Add validation for database type check
- [ ] Add error handling for missing entities

### Frontend

- [ ] Update `google-sheets.vue` to collect all required data
- [ ] Implement `saveServiceMutation` with proper payload
- [ ] Update `ChooseDirectionStep` to collect Google Sheet selection
- [ ] Add Google Sheet selection UI (existing sheets + create new option)
- [ ] Update stepper component events/props
- [ ] Add success/error handling and navigation
- [ ] Update `automations/index.vue` to implement delete functionality
- [ ] Add delete confirmation dialog
- [ ] Add loading states and error messages

### Testing

- [ ] Test creating automation with existing Google Sheet
- [ ] Test creating automation with new Google Sheet (if supported)
- [ ] Test error handling for missing accounts/entities
- [ ] Test delete functionality
- [ ] Test delete with non-existent automation
- [ ] Test delete with automation owned by different user

## Notes

1. **Google Sheet Creation**: The backend currently doesn't handle creating new Google Sheets. This would require:

   - Queue job to create sheet via Google Sheets API
   - Store created sheet in `googleSpreadsheet` table
   - Use the new sheet ID for automation

2. **Interval Selection**: Currently hardcoded to "5m". Could add UI to select interval in future.

3. **Automation Name**: Currently hardcoded. Could allow user to name their automation.

4. **UUID vs ID**: Backend uses integer IDs for FKs but UUIDs for external references. Delete endpoint uses UUID to avoid exposing internal IDs.

5. **Cascade Deletes**: Database schema should handle cascade deletes for related records (notionSheetsMapping, notionSheetsRowMapping, etc.).
