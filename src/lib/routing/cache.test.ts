import { afterEach, describe, expect, it, vi } from 'vitest'
import { redisRouteCache, routeCacheKey } from './cache'

const sydney = { lat: -33.86881, lng: 151.20929 }
const bondi = { lat: -33.8915, lng: 151.2767 }
const at = new Date('2026-11-01T22:00:00Z')

afterEach(() => vi.unstubAllEnvs())

describe('routeCacheKey', () => {
  it('is route:{sha256} and ignores precision beyond 4 dp', () => {
    const key = routeCacheKey(sydney, bondi, at)
    expect(key).toMatch(/^route:[0-9a-f]{64}$/)
    expect(routeCacheKey({ lat: -33.868812, lng: 151.209291 }, bondi, at)).toBe(key)
  })

  it('differs by direction, location and bucket', () => {
    const key = routeCacheKey(sydney, bondi, at)
    expect(routeCacheKey(bondi, sydney, at)).not.toBe(key)
    expect(routeCacheKey({ lat: -33.8689, lng: 151.2093 }, bondi, at)).not.toBe(key)
    expect(routeCacheKey(sydney, bondi, new Date('2026-11-01T22:15:00Z'))).not.toBe(key)
  })
})

describe('redisRouteCache', () => {
  it('without Upstash env is a no-op cache (always a miss)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    const cache = redisRouteCache()
    await cache.set('route:x', [])
    expect(await cache.get('route:x')).toBeNull()
  })
})
