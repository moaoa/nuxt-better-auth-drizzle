import { useDrizzle } from "~~/server/utils/drizzle";
import { automationType } from "~~/db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const db = useDrizzle();

  // Fix the sequence if it's out of sync
  const maxIdResult = await db.execute<{ max_id: number }>(
    sql`SELECT COALESCE(MAX(id), 0) as max_id FROM "automationType"`
  );
  const maxId = maxIdResult[0]?.max_id || 0;
  if (maxId > 0) {
    await db.execute(
      sql`SELECT setval('"automationType_id_seq"', ${maxId}, true)`
    );
    console.log(`Reset sequence to ${maxId}`);
  }

  // Check if automation types already exist
  const existingTypes = await db.query.automationType.findMany({
    where: (types, { inArray }) =>
      inArray(types.automationTypeKey, [
        "notion_db_to_google_sheet",
        "google_sheet_to_notion",
      ]),
  });

  const existingKeys = new Set(existingTypes.map((t) => t.automationTypeKey));

  const typesToInsert = [];

  if (!existingKeys.has("notion_db_to_google_sheet")) {
    typesToInsert.push({
      name: "Notion Database to Google Sheet",
      uuid: crypto.randomUUID(),
      automationTypeKey: "notion_db_to_google_sheet",
      description: "Sync data from a Notion database to a Google Sheet",
      disabled: false,
      icon: "",
      isHidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (!existingKeys.has("google_sheet_to_notion")) {
    typesToInsert.push({
      name: "Google Sheet to Notion",
      uuid: crypto.randomUUID(),
      automationTypeKey: "google_sheet_to_notion",
      description: "Sync data from a Google Sheet to a Notion database",
      disabled: false,
      icon: "",
      isHidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (typesToInsert.length > 0) {
    for (const type of typesToInsert) {
      try {
        await db.insert(automationType).values(type);
        console.log(`Added automation type: ${type.automationTypeKey}`);
      } catch (error: any) {
        // Ignore duplicate key errors (if id or uuid conflict)
        if (error?.code === "23505") {
          console.log(
            `Automation type ${type.automationTypeKey} already exists, skipping`
          );
        } else {
          throw error;
        }
      }
    }
    console.log(
      `Finished processing ${typesToInsert.length} automation type(s)`
    );
  } else {
    console.log("All automation types already exist");
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Error adding automation types:", error);
  process.exit(1);
});
