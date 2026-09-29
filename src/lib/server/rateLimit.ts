import type { NextFunction, Request, Response } from 'express';

/**
 * Tiny in-memory fixed-window limiter. Shared AI Studio apps spend the owner's Gemini quota,
 * so every AI endpoint is capped per client IP (and image rendering also has a global cap).
 */
export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Optional global ceiling across all clients within the same window. */
  globalMax?: number;
  message?: string;
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const global: Bucket = { count: 0, resetAt: 0 };
  const now = options.now ?? (() => Date.now());

  const hit = (bucket: Bucket, current: number) => {
    if (current >= bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = current + options.windowMs;
    }
    bucket.count++;
    return bucket.count;
  };

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const current = now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, resetAt: 0 };
      buckets.set(key, bucket);
    }
    const count = hit(bucket, current);
    const globalCount = options.globalMax ? hit(global, current) : 0;

    if (buckets.size > 5000) {
      for (const [bucketKey, value] of buckets) {
        if (current >= value.resetAt) buckets.delete(bucketKey);
      }
    }

    if (count > options.max || (options.globalMax && globalCount > options.globalMax)) {
      const retryAfter = Math.max(1, Math.ceil(((options.globalMax && globalCount > options.globalMax ? global : bucket).resetAt - current) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: options.message ?? 'Bạn thao tác hơi nhanh. Vui lòng thử lại sau ít phút.', retryAfter });
      return;
    }
    next();
  };
}
