<script setup lang="ts">
import { ref } from "vue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notionRepo } from "~~/repositories/notion";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const emit = defineEmits(["next", "prev", "database-selected"]);
const queryClient = useQueryClient();

const selectedDatabase = ref<string>();
const newDatabaseName = ref("");
const selectedParentPage = ref<string>();

// Fetch existing Notion databases
const {
  data: databases,
  isLoading: isDatabasesLoading,
  error: databasesError,
} = useQuery({
  queryKey: ["notionDatabases"],
  queryFn: () => notionRepo.getTopLevelPages(),
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

// Mutation to create a new Notion database
const createDatabaseMutation = useMutation({
  mutationFn: async (vars: { name: string; parentId: string }) => {
    return $fetch("/api/notion/databases", {
      method: "POST",
      body: { name: vars.name, parentId: vars.parentId },
    });
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ["notionDatabases"] });
    selectedDatabase.value = data.id; // Select the newly created database
    emit("database-selected", data.id);
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

// Handle creation of a new database
const handleCreateDatabase = () => {
  if (!selectedParentPage.value) {
    alert("Please select a page to create the database in.");
    return;
  }
  if (newDatabaseName.value.trim()) {
    createDatabaseMutation.mutate({
      name: newDatabaseName.value.trim(),
      parentId: selectedParentPage.value,
    });
  } else {
    alert("Please enter a name for the new database.");
  }
};

const proceedToNextStep = () => {
  if (selectedDatabase.value) {
    emit("next");
  } else {
    alert("Please select an existing database or create a new one.");
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
                  databases?.find((db) => db.id === selectedDatabase)?.title[0]
                    ?.plain_text
                : 'Select an existing database'
            "
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Existing Databases</SelectLabel>
            <SelectItem v-for="db in databases" :key="db.id" :value="db.id">
              {{ db.title[0]?.plain_text || "Untitled Database" }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>

    <div class="mt-4">
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
                :key="page.notionId"
                :value="page.notionId"
              >
                {{ page.titlePlain || "Untitled Page" }}
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
      <Button
        @click="handleCreateDatabase"
        :disabled="createDatabaseMutation.isPending || !selectedParentPage"
        class="mt-2"
      >
        {{
          createDatabaseMutation.isPending
            ? "Creating..."
            : "Create New Database"
        }}
      </Button>
    </div>

    <div class="mt-4">
      <Button @click="proceedToNextStep" :disabled="!selectedDatabase"
        >Proceed</Button
      >
    </div>
  </div>
</template>
