import { checkAndHangupExpiredCalls } from "~~/server/utils/call-hangup";

export default defineNitroPlugin((nitroApp) => {
  // Schedule a cron job to run every second to check for expired calls
  let intervalId: NodeJS.Timeout | null = null;

  // Run immediately on startup, then every second
  checkAndHangupExpiredCalls().catch((err) => {
    console.error("[Cron] Error in initial call hangup check:", err);
  });

  // Set up interval to run every second
  intervalId = setInterval(() => {
    checkAndHangupExpiredCalls().catch((err) => {
      console.error("[Cron] Error checking for expired calls:", err);
    });
  }, 1000); // 1000ms = 1 second

  console.log("[Cron] Call hangup checker started (runs every second)");

  // Cleanup on server close
  nitroApp.hooks.hook("close", () => {
    if (intervalId) {
      clearInterval(intervalId);
      console.log("[Cron] Call hangup checker stopped");
    }
  });
});
