import Redis from "ioredis";
import { useDrizzle } from "~~/server/utils/drizzle";
import { automation } from "~~/db/schema";
import { eq } from "drizzle-orm";

const redis = new Redis({
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
  password: process.env.REDIS_PASSWORD!,
});

const AUTOMATIONS_HASH_KEY = "automations";

export type AutomationCacheData = typeof automation.$inferSelect;

export const automationCache = {
  async populate() {
    console.log("Populating automations cache from database...");
    const db = useDrizzle();
    const activeAutomations = await db.query.automation.findMany({
      where: eq(automation.is_active, true),
    });

    const pipeline = redis.pipeline();
    pipeline.del(AUTOMATIONS_HASH_KEY); // Clear existing cache
    for (const auto of activeAutomations) {
      pipeline.hset(
        AUTOMATIONS_HASH_KEY,
        auto.id.toString(),
        JSON.stringify(auto)
      );
    }
    await pipeline.exec();
    console.log(
      `Cache populated with ${activeAutomations.length} automations.`
    );
  },

  async getAll(): Promise<AutomationCacheData[]> {
    const results = await redis.hvals(AUTOMATIONS_HASH_KEY);
    return results.map((res) => JSON.parse(res));
  },

  async addOrUpdate(auto: AutomationCacheData) {
    return redis.hset(
      AUTOMATIONS_HASH_KEY,
      auto.id.toString(),
      JSON.stringify(auto)
    );
  },

  async remove(automationId: number) {
    return redis.hdel(AUTOMATIONS_HASH_KEY, automationId.toString());
  },
};
