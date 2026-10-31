import { createHash } from "node:crypto";
import jwt, { JwtPayload } from "jsonwebtoken";
import tokenBlacklistModel from "../models/blacklist.model";
import { getRedis } from "../config/redis";

const ONE_DAY_SECONDS = 60 * 60 * 24;

// Hash the token so the Redis key is short and the raw token is never stored there.
const keyFor = (token: string): string =>
  `blacklist:${createHash("sha256").update(token).digest("hex")}`;

export async function blacklistToken(token: string): Promise<void> {
  const redis = getRedis();

  // No Redis configured (Render, tests): keep using MongoDB.
  if (!redis) {
    await tokenBlacklistModel.create({ token });
    return;
  }

  // Keep the key only as long as the token would have been valid anyway.
  const decoded = jwt.decode(token) as JwtPayload | null;
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = decoded?.exp ? decoded.exp - now : ONE_DAY_SECONDS;

  if (secondsLeft > 0) {
    await redis.set(keyFor(token), "1", "EX", secondsLeft);
  }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const redis = getRedis();

  if (!redis) {
    return (await tokenBlacklistModel.findOne({ token })) !== null;
  }

  return (await redis.exists(keyFor(token))) === 1;
}