import { useDrizzle } from "~~/server/utils/drizzle";
import { service } from "~~/db/schema";

async function main() {
  const db = useDrizzle();
  await db.transaction(async (trx) => {
    await trx.insert(service).values([
      {
        name: "QuickBooks",
        uuid: "36670194-231f-4a30-8427-643b951aaad8",
        service_key: "quickbooks",
        id: 1,
        description: "",
        icon: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Trello",
        uuid: "36670194-231f-4a30-8427-643b951aaad9",
        service_key: "trello",
        id: 2,
        description: "",
        icon: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });
}

main();
