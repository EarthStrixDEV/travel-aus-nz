import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'
import type { Point, RouteOption } from './types'

export const ROUTE_CACHE_TTL_S = 900

export interface RouteCache {
  get(key: string): Promise<RouteOption[] | null>
  set(key: string, options: RouteOption[]): Promise<void>
}

/** `route:{sha256}` of from/to rounded to 4 dp (~11 m) and the 15-minute departure bucket (Review Focus 2). */
export function routeCacheKey(from: Point, to: Point, departBucketUtc: Date): string {
  const p = (pt: Point) => `${pt.lat.toFixed(4)},${pt.lng.toFixed(4)}`
  const raw = `${p(from)}|${p(to)}|${departBucketUtc.toISOString()}`
  return `route:${createHash('sha256').update(raw).digest('hex')}`
}

const noCache: RouteCache = { get: async () => null, set: async () => {} }

let redis: Redis | null = null

/**
 * Upstash-backed cache (same `Redis.fromEnv()` as the rate limiter). Without Upstash env it never
 * hits; Redis errors are logged and treated as a miss so a cache outage never blocks planning.
 */
export function redisRouteCache(): RouteCache {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return noCache
  redis ??= Redis.fromEnv()
  const client = redis
  return {
    async get(key) {
      try {
        return (await client.get<RouteOption[]>(key)) ?? null
      } catch (err) {
        console.error('[routing] cache read failed', err)
        return null
      }
    },
    async set(key, options) {
      try {
        await client.set(key, options, { ex: ROUTE_CACHE_TTL_S })
      } catch (err) {
        console.error('[routing] cache write failed', err)
      }
    },
  }
}
