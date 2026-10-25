import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextResponse } from 'next/server';
import { apiError } from './errors';

const limiters = new Map<string, Ratelimit>();

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function getLimiter(limit: number, window: Duration, prefix: string): Ratelimit {
  const key = `${prefix}|${limit}|${window}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    // Constructed lazily so importing this module never requires Upstash env.
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `rl:${prefix}`,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

/**
 * Returns a 429 response when the caller's IP exceeded the limit, else null.
 * Missing Upstash env: fail-open with a warning outside production,
 * fail-closed (500 INTERNAL) in production. Upstash runtime errors fail open.
 */
export async function rateLimit(
  req: Request,
  opts: { limit?: number; window?: Duration; prefix?: string } = {},
): Promise<NextResponse | null> {
  const { limit = 60, window = '1 m', prefix = 'api' } = opts;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN missing in production');
      return apiError('INTERNAL', 'Rate limiter is not configured', 500);
    }
    console.warn('[rate-limit] Upstash env missing; rate limiting disabled (non-production)');
    return null;
  }

  let result: Awaited<ReturnType<Ratelimit['limit']>>;
  try {
    result = await getLimiter(limit, window, prefix).limit(clientIp(req));
  } catch (err) {
    console.error('[rate-limit] Upstash call failed; allowing request', err);
    return null;
  }
  if (result.success) return null;

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  const res = apiError('RATE_LIMITED', 'Too many requests', 429);
  res.headers.set('Retry-After', String(retryAfter));
  return res;
}
