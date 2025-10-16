import { useDrizzle } from "~~/server/utils/drizzle";
import { eq } from "drizzle-orm";
import { automation, googleSheetsAccount } from "~~/db/schema";
import { addNotionSyncJob } from "./notion-sync";
import { addGoogleSheetsJob } from "./googleSheetsQueue";
import { automationCache } from "~~/server/utils/automationCache";

function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(m|h)$/);
  if (!match) return 0;
  const value = parseInt(match[1]);
  const unit = match[2];
  if (unit === "m") {
    return value * 60 * 1000;
  } else if (unit === "h") {
    return value * 60 * 60 * 1000;
  }
  return 0;
}

export async function triggerAutomations() {
  console.log("Running automation trigger job");
  const db = useDrizzle();
  const cachedAutomations = await automationCache.getAll();

  // If cache is empty, populate it first. This handles the case where the
  // server starts and the cron job runs before the cache plugin has finished.
  if (cachedAutomations.length === 0) {
    console.log("Cache is empty, populating from DB before triggering...");
    await automationCache.populate();
    return; // Run again on the next cron cycle
  }

  const now = new Date();

  for (const auto of cachedAutomations) {
    const intervalMs = parseInterval(auto.interval);
    if (intervalMs === 0) continue;

    const lastSynced = auto.last_synced_at
      ? new Date(auto.last_synced_at)
      : null;
    const shouldRun =
      !lastSynced || now.getTime() > lastSynced.getTime() + intervalMs;

    if (shouldRun) {
      console.log(`Triggering automation: ${auto.name}`);
      if (auto.notion_account_id) {
        await addNotionSyncJob({
          userId: auto.user_id,
          notionAccountId: auto.notion_account_id,
        });
      } else if (auto.google_sheets_account_id) {
        const account = await db.query.googleSheetsAccount.findFirst({
          where: eq(googleSheetsAccount.id, auto.google_sheets_account_id),
        });
        if (account) {
          await addGoogleSheetsJob({
            userId: account.user_id,
            accessToken: account.access_token,
            refreshToken: account.refresh_token!,
          });
        }
      }

      // Update last_synced_at in both DB and cache
      const updatedAuto = { ...auto, last_synced_at: now };
      await db
        .update(automation)
        .set({ last_synced_at: now })
        .where(eq(automation.id, auto.id));
      await automationCache.addOrUpdate(updatedAuto);
    }
  }
}
