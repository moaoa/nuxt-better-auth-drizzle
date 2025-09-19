import { useDrizzle } from "~~/server/utils/drizzle";
import { service } from "~~/db/schema";

async function main() {
  const db = useDrizzle();
  await db.transaction(async (trx) => {
    await trx.insert(service).values([
      {
        name: "QuickBooks",
        uuid: crypto.randomUUID(),
        service_key: "quickbooks",
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
        service_key: "google_sheet",
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
        service_key: "notion",
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
