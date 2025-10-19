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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const emit = defineEmits(["next", "prev"]);

const direction = ref("notion-to-google-sheet");
const automationType = ref("");
const notionTB = ref("");
const newGoogleSheet = ref(false);
const googleSheetName = ref("");
const googleSheet = ref("");
const newNotionTB = ref(false);
const selectedParentPage = ref("");
const notionTBName = ref("");
const notionTBSelect = ref("");
const notionBlockId = ref("");
const googleSheetCellRange = ref("");

enum AutomationType {
  NOTION_DB_TO_GOOGLE_SHEET = "notion-db-to-google-sheet",
  NOTION_BLOCK_TO_GOOGLE_SHEET_CELL = "notion-block-to-google-sheet-cell",
}

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

const handleProceed = () => {
  emit("next");
};
</script>

<template>
  <div class="space-y-4">
    <RadioGroup v-model="direction" class="flex space-x-4">
      <div
        class="flex items-center space-x-2 p-4 border rounded-md has-[:checked]:bg-gray-100 dark:has-[:checked]:bg-gray-800"
      >
        <RadioGroupItem
          id="notion-to-google-sheet"
          value="notion-to-google-sheet"
          class="w-12 h-12"
        />
        <Label for="notion-to-google-sheet" class="text-xl"
          >From Notion to Google Sheet</Label
        >
      </div>
      <div
        class="flex items-center space-x-2 p-4 border rounded-md has-[:checked]:bg-gray-100 dark:has-[:checked]:bg-gray-800"
      >
        <RadioGroupItem
          id="google-sheet-to-notion"
          value="google-sheet-to-notion"
          class="w-12 h-12"
        />
        <Label for="google-sheet-to-notion" class="text-xl"
          >From Google Sheet to Notion</Label
        >
      </div>
    </RadioGroup>

    <div class="space-y-2">
      <Label for="automation-type">AutomationType</Label>
      <Select v-model="automationType">
        <SelectTrigger id="automation-type">
          <SelectValue placeholder="Select an automation type" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Automation Types</SelectLabel>
            <SelectItem :value="AutomationType.NOTION_DB_TO_GOOGLE_SHEET">
              Notion db to Google Sheet
            </SelectItem>
            <SelectItem
              :value="AutomationType.NOTION_BLOCK_TO_GOOGLE_SHEET_CELL"
            >
              Notion block to Google Sheet cell
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>

    <div
      v-if="automationType === AutomationType.NOTION_BLOCK_TO_GOOGLE_SHEET_CELL"
    >
      <div class="space-y-2">
        <Label for="notion-block-id">Notion Block ID</Label>
        <Input
          id="notion-block-id"
          v-model="notionBlockId"
          placeholder="Enter Notion Block ID"
        />
      </div>
      <div class="space-y-2">
        <Label for="google-sheet-cell-range">Google Sheet Cell Range</Label>
        <Input
          id="google-sheet-cell-range"
          v-model="googleSheetCellRange"
          placeholder="Enter Google Sheet Cell Range"
        />
      </div>
    </div>
    <div v-else-if="direction === 'notion-to-google-sheet'">
      <div class="space-y-2">
        <Label for="notion-tb">Notion Database (Source)</Label>
        <Select v-model="notionTB">
          <SelectTrigger id="notion-tb">
            <SelectValue placeholder="Select a Notion Database" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Notion Databases</SelectLabel>
              <div v-if="isDatabasesLoading">Loading...</div>
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

      <div class="flex items-center space-x-2 mt-4">
        <Switch id="new-google-sheet" v-model:checked="newGoogleSheet" />
        <Label for="new-google-sheet"
          >Create New Google Sheet (Destination)</Label
        >
      </div>

      <div v-if="newGoogleSheet" class="space-y-2 mt-2">
        <Label for="google-sheet-name">Google Sheet Name</Label>
        <Input
          id="google-sheet-name"
          v-model="googleSheetName"
          placeholder="Enter Google Sheet Name"
        />
      </div>

      <div v-if="!newGoogleSheet" class="space-y-2 mt-2">
        <Label for="google-sheet">Google Sheet (Destination)</Label>
        <Select v-model="googleSheet">
          <SelectTrigger id="google-sheet">
            <SelectValue placeholder="Select a Google Sheet" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Google Sheets</SelectLabel>
              <div v-if="isSheetsLoading">Loading...</div>
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

    <div v-else>
      <div class="space-y-2">
        <Label for="google-sheet-source">Google Sheet (Source)</Label>
        <Select v-model="googleSheet">
          <SelectTrigger id="google-sheet-source">
            <SelectValue placeholder="Select a Google Sheet" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Google Sheets</SelectLabel>
              <div v-if="isSheetsLoading">Loading...</div>
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

      <div class="flex items-center space-x-2 mt-4">
        <Switch id="new-notion-tb" v-model:checked="newNotionTB" />
        <Label for="new-notion-tb"
          >Create New Notion Database (Destination)</Label
        >
      </div>

      <div v-if="newNotionTB" class="space-y-2 mt-2">
        <Label for="parent-notion-page"
          >Select Parent Notion Page (optional)</Label
        >
        <Select v-model="selectedParentPage">
          <SelectTrigger id="parent-notion-page">
            <SelectValue placeholder="Select a parent page" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Top-Level Pages</SelectLabel>
              <div v-if="isPagesLoading">Loading...</div>
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

        <Label for="notion-tb-name" class="mt-2">Notion Database Name</Label>
        <Input
          id="notion-tb-name"
          v-model="notionTBName"
          placeholder="Enter Notion Database Name"
        />
      </div>

      <div v-if="!newNotionTB" class="space-y-2 mt-2">
        <Label for="notion-tb-select">Notion Database (Destination)</Label>
        <Select v-model="notionTBSelect">
          <SelectTrigger id="notion-tb-select">
            <SelectValue placeholder="Select a Notion Database" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Notion Databases</SelectLabel>
              <div v-if="isDatabasesLoading">Loading...</div>
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
      <Button @click="handleProceed">
        <span>Proceed</span>
      </Button>
    </div>
  </div>
</template>
