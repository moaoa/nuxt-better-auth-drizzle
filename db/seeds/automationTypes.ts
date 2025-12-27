import { useDrizzle } from "~~/server/utils/drizzle";
import { automationType } from "~~/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function automationTypes() {
  const db = useDrizzle();
  
  const typesToInsert = [
    {
      name: "QuickBooks",
      uuid: crypto.randomUUID(),
      automationTypeKey: "quickbooks",
      description: "",
      disabled: true,
      icon: "",
      isHidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Google Sheets",
      uuid: crypto.randomUUID(),
      automationTypeKey: "google_sheet",
      description: "",
      disabled: false,
      icon: "",
      isHidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Notion",
      uuid: crypto.randomUUID(),
      automationTypeKey: "notion",
      description: "",
      disabled: true,
      icon: "",
      isHidden: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Notion Database to Google Sheet",
      uuid: crypto.randomUUID(),
      automationTypeKey: "notion_db_to_google_sheet",
      description: "Sync data from a Notion database to a Google Sheet",
      disabled: false,
      icon: "",
      isHidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Google Sheet to Notion",
      uuid: crypto.randomUUID(),
      automationTypeKey: "google_sheet_to_notion",
      description: "Sync data from a Google Sheet to a Notion database",
      disabled: false,
      icon: "",
      isHidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Check which types already exist
  const existingTypes = await db.query.automationType.findMany({
    where: inArray(
      automationType.automationTypeKey,
      typesToInsert.map((t) => t.automationTypeKey)
    ),
  });

  const existingKeys = new Set(existingTypes.map((t) => t.automationTypeKey));
  const newTypes = typesToInsert.filter(
    (t) => !existingKeys.has(t.automationTypeKey)
  );

  if (newTypes.length > 0) {
    for (const type of newTypes) {
      try {
        await db.insert(automationType).values(type);
        console.log(`Added automation type: ${type.automationTypeKey}`);
      } catch (error: any) {
        // Ignore duplicate key errors
        if (error?.code === "23505") {
          console.log(
            `Automation type ${type.automationTypeKey} already exists, skipping`
          );
        } else {
          throw error;
        }
      }
    }
    console.log(`Finished processing ${newTypes.length} new automation type(s)`);
  } else {
    console.log("All automation types already exist");
  }
}

// Allow running directly: tsx db/seeds/automationTypes.ts
if (process.argv[1]?.endsWith("automationTypes.ts")) {
  automationTypes()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Error running automationTypes seeder:", error);
      process.exit(1);
    });
}
