<script setup lang="ts">
import { ref, computed } from "vue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { notionRepo } from "~~/repositories/notion";
import { googleSheetsRepo } from "~~/repositories/google-sheets";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const emit = defineEmits([
  "next",
  "prev",
  "database-selected",
  "sheet-selected",
]);
const queryClient = useQueryClient();

const createNewDatabase = ref(false);
const selectedDatabase = ref("");
const newDatabaseName = ref("");
const selectedParentPage = ref<string>("");
const selectedSheet = ref<string>("");

// Fetch existing Notion databases
const {
  data: databases,
  isLoading: isDatabasesLoading,
  error: databasesError,
} = useQuery({
  queryKey: ["notionDatabases"],
  queryFn: () => notionRepo.getTopLevelPages(),
});

// Fetch Google Sheets
const {
  data: googleSheets,
  isLoading: isSheetsLoading,
  error: sheetsError,
} = useQuery({
  queryKey: ["googleSheets"],
  queryFn: () => googleSheetsRepo.getSheets(),
});

// Fetch top-level pages
const {
  data: topLevelPages,
  isLoading: isPagesLoading,
  error: pagesError,
} = useQuery({
  queryKey: ["notionTopLevelPages"],
  queryFn: () => notionRepo.getTopLevelPages(),
});

const createDatabaseMutation = useMutation({
  mutationFn: async (vars: { name: string; parentId: string }) => {
    // return $fetch("/api/notion/databases", {
    //   method: "POST",
    //   body: { name: vars.name, parentId: vars.parentId },
    // });
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ["notionDatabases"] });
    selectedDatabase.value = data.id; // Select the newly created database
    emit("database-selected", data.id);
    emit("next");
  },
  onError: (error) => {
    console.error("Error creating database:", error);
    alert("Failed to create database. Please try again.");
  },
});

// Handle selection of an existing database
const handleDatabaseSelection = (dbId: string) => {
  selectedDatabase.value = dbId;
  emit("database-selected", dbId);
};

const handleSheetSelection = (sheetId: string) => {
  selectedSheet.value = sheetId;
  emit("sheet-selected", sheetId);
};

const isProceedDisabled = computed(() => {
  if (createNewDatabase.value) {
    return (
      !selectedParentPage.value ||
      !newDatabaseName.value.trim() ||
      createDatabaseMutation.isPending
    );
  } else {
    return !selectedDatabase.value;
  }
});

const handleProceed = () => {
  if (createNewDatabase.value) {
    createDatabaseMutation.mutate({
      name: newDatabaseName.value.trim(),
      parentId: selectedParentPage.value,
    });
  } else {
    emit("next");
  }
};
</script>

<template>
  <div>
    <h2>Step 3: Create or Select Notion Database</h2>
    <p>
      Choose an existing Notion database or create a new one to sync your
      QuickBooks data.
    </p>

    <div class="flex items-center space-x-2 my-4">
      <Switch id="create-new-db" v-model:checked="createNewDatabase" />
      <Label for="create-new-db">Create a new database</Label>
    </div>

    <div v-if="!createNewDatabase">
      <div v-if="isDatabasesLoading">Loading databases...</div>
      <div v-else-if="databasesError">Error: {{ databasesError.message }}</div>
      <div v-else>
        <Select
          v-model="selectedDatabase"
          @update:modelValue="handleDatabaseSelection"
        >
          <SelectTrigger>
            <SelectValue
              :placeholder="
                selectedDatabase
                  ? 'Selected: ' +
                    databases?.find((db) => db.uuid === selectedDatabase)?.title
                  : 'Select an existing database'
              "
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Existing Databases</SelectLabel>
              <SelectItem
                v-for="db in databases"
                :key="db.uuid"
                :value="`${db.uuid}`"
              >
                {{ db.title || "Untitled Database" }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="mt-4">
      <h3>Select Google Sheet</h3>
      <div v-if="isSheetsLoading">Loading sheets...</div>
      <div v-else-if="sheetsError">Error: {{ sheetsError.message }}</div>
      <div v-else>
        <Select
          v-model="selectedSheet"
          @update:modelValue="handleSheetSelection"
        >
          <SelectTrigger>
            <SelectValue
              :placeholder="
                selectedSheet
                  ? 'Selected: ' +
                    googleSheets?.sheets?.find(
                      (s) => s.googleSpreadsheetId === selectedSheet
                    )?.title
                  : 'Select a Google Sheet'
              "
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Google Sheets</SelectLabel>
              <SelectItem
                v-for="sheet in googleSheets?.sheets ?? []"
                :key="sheet.googleSpreadsheetId"
                :value="sheet.googleSpreadsheetId"
              >
                {{ sheet.title }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="mt-4" v-if="createNewDatabase">
      <h3>Create New Database</h3>

      <div v-if="isPagesLoading">Loading pages...</div>
      <div v-else-if="pagesError">
        Error loading pages: {{ pagesError.message }}
      </div>
      <div v-else>
        <Select v-model="selectedParentPage">
          <SelectTrigger>
            <SelectValue placeholder="Select a parent page" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Top-Level Pages</SelectLabel>
              <SelectItem
                v-for="page in topLevelPages"
                :key="`${page.uuid}`"
                :value="`${page.uuid}`"
              >
                {{ page.title || "Untitled Page" }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Input
        v-model="newDatabaseName"
        placeholder="Enter a name for the new database"
        class="mt-2"
      />
    </div>

    <div class="mt-4">
      <Button @click="handleProceed" :disabled="isProceedDisabled">
        <span v-if="createNewDatabase && createDatabaseMutation.isPending"
          >Creating...</span
        >
        <span v-else-if="createNewDatabase">Create and Proceed</span>
        <span v-else>Proceed</span>
      </Button>
    </div>
  </div>
</template>
