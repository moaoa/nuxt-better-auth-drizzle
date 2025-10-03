import { useDrizzle } from "~~/server/utils/drizzle";
import { automationType } from "~~/db/schema";

async function main() {
  const db = useDrizzle();
  await db.transaction(async (trx) => {
    await trx.insert(automationType).values([
      {
        name: "QuickBooks",
        uuid: crypto.randomUUID(),
        automationTypeKey: "quickbooks",
        id: 1,
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
        id: 2,
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
        id: 3,
        description: "",
        disabled: true,
        icon: "",
        isHidden: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });
}

main();
