import { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * In-memory rate limiting middleware for ingestion and sensitive endpoints.
 * Returns 429 Too Many Requests with standard Retry-After header.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) {
  const { windowMs, max } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limits during tests unless explicitly testing rate limits
    if (process.env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"]) {
      return next();
    }

    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.headers["x-forwarded-for"] as string) || req.ip || "unknown_client";

    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: "TooManyRequests",
        message: "Rate limit exceeded. Please back off before retrying."
      });
      return;
    }

    entry.count += 1;
    next();
  };
}
