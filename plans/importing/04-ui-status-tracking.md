# UI Status Tracking and Polling

## Overview

This document covers the frontend implementation for displaying import progress and status to users when an automation is being initialized.

## Objectives

1. Display import status in automation list UI
2. Show spinner/loading indicator for automations with `import_status = "importing"`
3. Poll automation status every 10 seconds
4. Update UI when import completes or fails
5. Show progress percentage if available

## Implementation Details

### 1. Backend API Endpoint

**File**: `server/api/automations/[uuid].get.ts` (new or update existing)

Return automation with import status:

```typescript
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  const automationUuid = getRouterParam(event, "uuid");

  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const db = useDrizzle();

  const automationRecord = await db.query.automation.findFirst({
    where: and(
      eq(automation.uuid, automationUuid),
      eq(automation.user_id, session.user.id)
    ),
    columns: {
      id: true,
      uuid: true,
      name: true,
      is_active: true,
      import_status: true,
      import_started_at: true,
      import_completed_at: true,
      import_total_rows: true,
      import_processed_rows: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!automationRecord) {
    throw createError({
      statusCode: 404,
      message: "Automation not found",
    });
  }

  return automationRecord;
});
```

**File**: `server/api/automations/index.get.ts` (update existing)

Include import status in list:

```typescript
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });

  if (!session?.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const db = useDrizzle();

  const automations = await db.query.automation.findMany({
    where: eq(automation.user_id, session.user.id),
    columns: {
      id: true,
      uuid: true,
      name: true,
      is_active: true,
      import_status: true,
      import_started_at: true,
      import_completed_at: true,
      import_total_rows: true,
      import_processed_rows: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [desc(automation.createdAt)],
  });

  return automations;
});
```

### 2. Frontend Types

**File**: `types/automations.ts` (update existing)

```typescript
export type ImportStatus = "pending" | "importing" | "completed" | "failed";

export interface Automation {
  id: number;
  uuid: string;
  name: string;
  is_active: boolean;
  import_status?: ImportStatus;
  import_started_at?: string | Date;
  import_completed_at?: string | Date;
  import_total_rows?: number;
  import_processed_rows?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}
```

### 3. Automation List Component

**File**: `app/pages/app/automations/index.vue` (update existing)

Add import status display:

```vue
<template>
  <div>
    <!-- Existing automation list -->
    <div v-for="automation in automations" :key="automation.uuid">
      <div class="automation-item">
        <div class="automation-header">
          <h3>{{ automation.name }}</h3>
          <div class="automation-status">
            <!-- Import status indicator -->
            <div v-if="automation.import_status === 'importing'" class="import-status">
              <Spinner size="sm" />
              <span>Importing...</span>
              <span v-if="automation.import_total_rows && automation.import_processed_rows">
                ({{ Math.round((automation.import_processed_rows / automation.import_total_rows) * 100) }}%)
              </span>
            </div>
            <div v-else-if="automation.import_status === 'completed'" class="import-status success">
              <CheckIcon />
              <span>Import complete</span>
            </div>
            <div v-else-if="automation.import_status === 'failed'" class="import-status error">
              <ErrorIcon />
              <span>Import failed</span>
            </div>
            
            <!-- Active status -->
            <Badge :variant="automation.is_active ? 'success' : 'default'">
              {{ automation.is_active ? 'Active' : 'Inactive' }}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, onMounted, onUnmounted } from 'vue';
import type { Automation } from '~/types/automations';

// Fetch automations
const { data: automations, refetch } = useQuery({
  queryKey: ['automations'],
  queryFn: async () => {
    const response = await $fetch<Automation[]>('/api/automations');
    return response;
  },
});

// Polling logic
let pollInterval: ReturnType<typeof setInterval> | null = null;

const hasImportingAutomations = computed(() => {
  return automations.value?.some(a => a.import_status === 'importing') || false;
});

onMounted(() => {
  // Start polling if there are importing automations
  if (hasImportingAutomations.value) {
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});

const startPolling = () => {
  // Poll every 10 seconds
  pollInterval = setInterval(() => {
    refetch();
    
    // Stop polling if no importing automations
    if (!hasImportingAutomations.value) {
      stopPolling();
    }
  }, 10000); // 10 seconds
};

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};

// Watch for importing automations
watch(hasImportingAutomations, (newValue) => {
  if (newValue && !pollInterval) {
    startPolling();
  } else if (!newValue && pollInterval) {
    stopPolling();
  }
});
</script>

<style scoped>
.import-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.import-status.success {
  color: green;
}

.import-status.error {
  color: red;
}
</style>
```

### 4. Polling Hook (Optional - Reusable)

**File**: `composables/useAutomationPolling.ts` (new)

Create reusable polling composable:

```typescript
import { useQuery } from '@tanstack/vue-query';
import { computed, watch, onMounted, onUnmounted } from 'vue';
import type { Automation } from '~/types/automations';

export function useAutomationPolling(automationUuid?: string) {
  const queryKey = automationUuid 
    ? ['automation', automationUuid]
    : ['automations'];

  const { data, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (automationUuid) {
        return await $fetch<Automation>(`/api/automations/${automationUuid}`);
      } else {
        return await $fetch<Automation[]>('/api/automations');
      }
    },
  });

  const hasImportingAutomations = computed(() => {
    if (automationUuid) {
      return (data.value as Automation)?.import_status === 'importing';
    } else {
      return (data.value as Automation[])?.some(a => a.import_status === 'importing') || false;
    }
  });

  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const startPolling = () => {
    if (pollInterval) return;
    
    pollInterval = setInterval(() => {
      refetch();
      
      if (!hasImportingAutomations.value) {
        stopPolling();
      }
    }, 10000); // 10 seconds
  };

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  onMounted(() => {
    if (hasImportingAutomations.value) {
      startPolling();
    }
  });

  onUnmounted(() => {
    stopPolling();
  });

  watch(hasImportingAutomations, (newValue) => {
    if (newValue && !pollInterval) {
      startPolling();
    } else if (!newValue && pollInterval) {
      stopPolling();
    }
  });

  return {
    data,
    refetch,
    hasImportingAutomations,
    startPolling,
    stopPolling,
  };
}
```

### 5. Progress Bar Component (Optional)

**File**: `app/components/automations/ImportProgress.vue` (new)

```vue
<template>
  <div v-if="automation.import_status === 'importing'" class="import-progress">
    <div class="progress-bar">
      <div 
        class="progress-fill" 
        :style="{ width: `${progressPercentage}%` }"
      />
    </div>
    <div class="progress-text">
      {{ automation.import_processed_rows || 0 }} / {{ automation.import_total_rows || 0 }} rows
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Automation } from '~/types/automations';

const props = defineProps<{
  automation: Automation;
}>();

const progressPercentage = computed(() => {
  if (!props.automation.import_total_rows || !props.automation.import_processed_rows) {
    return 0;
  }
  return Math.round((props.automation.import_processed_rows / props.automation.import_total_rows) * 100);
});
</script>

<style scoped>
.import-progress {
  margin-top: 0.5rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #3b82f6;
  transition: width 0.3s ease;
}

.progress-text {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #6b7280;
}
</style>
```

### 6. Toast Notifications (Optional)

Show notifications when import completes:

```typescript
// In automation list component
watch(() => automations.value, (newAutomations, oldAutomations) => {
  if (!oldAutomations) return;

  newAutomations?.forEach((automation) => {
    const oldAutomation = oldAutomations.find(a => a.uuid === automation.uuid);
    
    if (oldAutomation?.import_status === 'importing' && automation.import_status === 'completed') {
      toast.success(`Import completed for ${automation.name}`);
    }
    
    if (oldAutomation?.import_status === 'importing' && automation.import_status === 'failed') {
      toast.error(`Import failed for ${automation.name}`);
    }
  });
}, { deep: true });
```

### 7. Error Handling

Handle API errors gracefully:

```typescript
const { data: automations, error, refetch } = useQuery({
  queryKey: ['automations'],
  queryFn: async () => {
    try {
      return await $fetch<Automation[]>('/api/automations');
    } catch (error) {
      console.error('Failed to fetch automations:', error);
      throw error;
    }
  },
  retry: 3,
  retryDelay: 1000,
});
```

### 8. Performance Considerations

1. **Polling Frequency**: 10 seconds is a good balance between responsiveness and server load
2. **Conditional Polling**: Only poll when there are importing automations
3. **Stop Polling**: Automatically stop when no importing automations remain
4. **Debouncing**: Consider debouncing refetch calls if needed

### 9. Testing Considerations

1. **Polling**: Verify polling starts/stops correctly
2. **Status Updates**: Test status changes from importing → completed
3. **Progress Display**: Test progress percentage calculation
4. **Error States**: Test failed import display
5. **Multiple Automations**: Test with multiple importing automations

## Summary

The UI will:
- Display import status with spinner for importing automations
- Show progress percentage when available
- Poll every 10 seconds while imports are in progress
- Automatically stop polling when imports complete
- Show success/error states appropriately

This provides users with real-time feedback on the import process without excessive server load.

