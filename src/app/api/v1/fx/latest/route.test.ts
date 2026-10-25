import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getLatestSnapshot = vi.fn()
vi.mock('@/lib/fx/queries', () => ({ getLatestSnapshot: (...a: unknown[]) => getLatestSnapshot(...a) }))
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_k: string[], _t: string, fn: () => unknown) => fn }))

import { GET } from './route'

const call = (qs = '') => GET(new NextRequest(`http://localhost:3000/api/v1/fx/latest${qs}`))
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const snap = (h: number) => ({ base: 'AUD', rates: { AUD: 1, NZD: 1.1, THB: 22 }, fetched_at: hoursAgo(h), source: 'frankfurter' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/v1/fx/latest', () => {
  it('fresh snapshot -> 200, stale false, edge-cached for an hour', async () => {
    getLatestSnapshot.mockResolvedValue(snap(1))
    const res = await call('?base=AUD')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=3600')
    expect(await res.json()).toMatchObject({ base: 'AUD', rates: { THB: 22 }, source: 'frankfurter', stale: false })
  })

  it('snapshot 7 h old -> 200 with stale: true (never an empty error)', async () => {
    getLatestSnapshot.mockResolvedValue(snap(7))
    const res = await call()
    expect(res.status).toBe(200)
    expect((await res.json()).stale).toBe(true)
  })

  it('just under 6 h is not stale', async () => {
    getLatestSnapshot.mockResolvedValue(snap(5.9))
    expect((await (await call()).json()).stale).toBe(false)
  })

  it('no snapshot -> 503 FX_UNAVAILABLE, not cacheable', async () => {
    getLatestSnapshot.mockResolvedValue(null)
    const res = await call()
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('FX_UNAVAILABLE')
    expect(res.headers.get('cache-control') ?? '').not.toContain('s-maxage')
  })

  it('db error -> 503 FX_UNAVAILABLE envelope', async () => {
    getLatestSnapshot.mockRejectedValue(new Error('db down'))
    const res = await call()
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('FX_UNAVAILABLE')
  })

  it.each(['?base=USD', '?base=xx'])('%s -> 400 VALIDATION', async (qs) => {
    const res = await call(qs)
    expect(res.status).toBe(400)
    expect(getLatestSnapshot).not.toHaveBeenCalled()
  })
})
