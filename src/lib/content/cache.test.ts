import { beforeEach, describe, expect, it, vi } from 'vitest'

const unstableCache = vi.fn((fn: () => Promise<unknown>) => fn)
vi.mock('next/cache', () => ({ unstable_cache: (...args: unknown[]) => unstableCache(...(args as [() => Promise<unknown>])) }))

import { CACHE_TAGS, cachedContent } from './cache'

describe('cachedContent', () => {
  beforeEach(() => unstableCache.mockClear())

  it('wraps unstable_cache with the tag and default revalidate', async () => {
    const fn = vi.fn(async () => 42)
    const wrapped = cachedContent(['k'], 'fx', fn)
    expect(unstableCache).toHaveBeenCalledWith(fn, ['k'], { tags: ['fx'], revalidate: 3600 })
    await expect(wrapped()).resolves.toBe(42)
  })

  it('honours a custom revalidate', () => {
    cachedContent(['k'], 'home', async () => 1, 60)
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ['k'], { tags: ['home'], revalidate: 60 })
  })

  it('exposes the tag set', () => {
    expect(Object.keys(CACHE_TAGS).sort()).toEqual(['entry', 'fx', 'gallery', 'home', 'map', 'venues'])
  })
})
