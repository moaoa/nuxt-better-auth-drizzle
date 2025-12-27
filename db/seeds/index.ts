import { addAutomationTypes } from "./add-automation-types";
import { automationTypes } from "./automationTypes";

/**
 * Array of seeder functions to run
 * Each seeder should be an async function that returns void
 */
const seeders = [
  { name: "addAutomationTypes", fn: addAutomationTypes },
  { name: "automationTypes", fn: automationTypes },
];

async function main() {
  console.log(`Running ${seeders.length} seeder(s)...\n`);

  for (let i = 0; i < seeders.length; i++) {
    const seeder = seeders[i];
    const seederName = seeder.name;

    try {
      console.log(`[${i + 1}/${seeders.length}] Running ${seederName}...`);
      await seeder.fn();
      console.log(`✓ ${seederName} completed successfully\n`);
    } catch (error) {
      console.error(`✗ ${seederName} failed:`, error);
      process.exit(1);
    }
  }

  console.log("All seeders completed successfully!");
  process.exit(0);
}

main().catch((error) => {
  console.error("Error running seeders:", error);
  process.exit(1);
});
