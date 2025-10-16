import { automationCache } from "~~/server/utils/automationCache";

export default defineNitroPlugin(async (nitroApp) => {
  if (
    process.env.NODE_ENV === "development" &&
    !process.env.NUXT_DISABLE_CACHE_POPULATION
  ) {
    console.log(
      "Skipping cache population in development to avoid race conditions during HMR."
    );
    console.log(
      "The cache will be populated by the first run of the cron job."
    );
    return;
  }

  try {
    await automationCache.populate();
  } catch (error) {
    console.error("Failed to populate automation cache:", error);
  }
});
