import { Redis } from "ioredis";

let client: Redis | null = null;

export const connectRedis = async (): Promise<void> => {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("REDIS_URL not set, running without Redis");
    return;
  }
  client = new Redis(url, { maxRetriesPerRequest: 2 });
  client.on("error", (err) => console.error("Redis error:", err.message));
  await client.ping();
  console.log("Connected to Redis");
};

export const getRedis = (): Redis | null => client;