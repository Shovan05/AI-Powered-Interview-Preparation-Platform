import { getRedis } from "../config/redis";

// Cache failures must never break a request: on any error, behave like a miss.

export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    console.error("Cache read failed:", (err as Error).message);
    return null;
  }
}

export async function setCached(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error("Cache write failed:", (err as Error).message);
  }
}

export async function deleteCached(...keys: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(...keys);
  } catch (err) {
    console.error("Cache delete failed:", (err as Error).message);
  }
}