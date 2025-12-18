import Redis from "ioredis";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

async function flushRedis() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
  });

  try {
    console.log("Connecting to Redis...");
    await redis.ping();
    console.log("Connected to Redis successfully.");

    console.log("Flushing Redis cache...");
    await redis.flushall();
    console.log("✅ Redis cache flushed successfully.");

    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error flushing Redis cache:", error);
    await redis.quit();
    process.exit(1);
  }
}

flushRedis();

