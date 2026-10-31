import { Request, Response, NextFunction, RequestHandler } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore, RedisReply } from "rate-limit-redis";
import { getRedis } from "../config/redis";

// Redis connects after this file is imported, so build each limiter on the
// first request instead of at import time.
const lazy = (build: () => RequestHandler): RequestHandler => {
  let handler: RequestHandler | undefined;
  return (req: Request, res: Response, next: NextFunction) => {
    handler ??= build();
    return handler(req, res, next);
  };
};

const makeStore = (prefix: string) => {
  const redis = getRedis();
  if (!redis) return undefined; // falls back to in-memory counters

  return new RedisStore({
    prefix,
    sendCommand: (...args: [string, ...string[]]) =>
      redis.call(...args) as Promise<RedisReply>,
  });
};

// Login / register: 10 attempts per 15 minutes per IP
export const authLimiter = lazy(() =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
        validate: { creationStack: false }, // limiter is built once, lazily, after Redis connects
    skip: () => process.env.NODE_ENV === "test",
    store: makeStore("rl:auth:"),
    message: { message: "Too many attempts. Please try again later." },
  })
);

// Report and PDF generation: 10 per hour per user (falls back to IP)
export const reportLimiter = lazy(() =>
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
        validate: { creationStack: false }, // limiter is built once, lazily, after Redis connects
    skip: () => process.env.NODE_ENV === "test",
    store: makeStore("rl:report:"),
    keyGenerator: (req) =>
      req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip ?? ""),
    message: { message: "Report limit reached. Please try again later." },
  })
);