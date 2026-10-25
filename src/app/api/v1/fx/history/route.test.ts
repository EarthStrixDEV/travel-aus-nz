import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getCloses = vi.fn()
vi.mock('@/lib/fx/queries', () => ({ getCloses: (...a: unknown[]) => getCloses(...a) }))
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_k: string[], _t: string, fn: () => unknown) => fn }))

import { GET } from './route'

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/api/v1/fx/history${qs}`))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/v1/fx/history', () => {
  it('AUD pair: points, high, low and % change, cached 6 h', async () => {
    getCloses.mockResolvedValue([
      { day: '2026-10-01', quote: 'THB', close: 20 },
      { day: '2026-10-02', quote: 'THB', close: 22 },
      { day: '2026-10-03', quote: 'THB', close: 21 },
    ])
    const res = await call('?pair=AUD-THB&range=7d')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=21600')
    expect(getCloses).toHaveBeenCalledWith(expect.anything(), ['THB'], 7)
    expect(await res.json()).toEqual({
      points: [
        { day: '2026-10-01', close: 20 },
        { day: '2026-10-02', close: 22 },
        { day: '2026-10-03', close: 21 },
      ],
      high: 22,
      low: 20,
      change: 5,
    })
  })

  it('NZD pair is derived as close(Q) / close(NZD), matched by day', async () => {
    getCloses.mockResolvedValue([
      { day: '2026-10-01', quote: 'THB', close: 22 },
      { day: '2026-10-01', quote: 'NZD', close: 1.1 },
      { day: '2026-10-02', quote: 'THB', close: 22 },
      { day: '2026-10-02', quote: 'NZD', close: 1.2 },
      { day: '2026-10-03', quote: 'THB', close: 23 }, // no NZD that day: dropped
    ])
    const body = await (await call('?pair=NZD-THB&range=1m')).json()
    expect(getCloses).toHaveBeenCalledWith(expect.anything(), ['THB', 'NZD'], 30)
    expect(body.points).toHaveLength(2)
    expect(body.points[0].close).toBeCloseTo(20, 8)
    expect(body.points[1].close).toBeCloseTo(22 / 1.2, 8)
  })

  it('NZD-AUD is 1 / close(NZD)', async () => {
    getCloses.mockResolvedValue([{ day: '2026-10-01', quote: 'NZD', close: 1.25 }])
    const body = await (await call('?pair=NZD-AUD&range=3m')).json()
    expect(getCloses).toHaveBeenCalledWith(expect.anything(), ['NZD'], 90)
    expect(body.points[0].close).toBeCloseTo(0.8, 8)
  })

  it('no history yet -> 200 with empty points and null stats', async () => {
    getCloses.mockResolvedValue([])
    expect(await (await call('?pair=AUD-THB&range=1y')).json()).toEqual({ points: [], high: null, low: null, change: null })
  })

  it.each([
    '',
    '?pair=AUD-THB',
    '?pair=AUD-THB&range=5y',
    '?pair=THB-AUD&range=7d',
    '?pair=AUD-AUD&range=7d',
    '?pair=AUD-XXX&range=7d',
    '?pair=NZD-NZD&range=7d',
  ])('%s -> 400 VALIDATION', async (qs) => {
    const res = await call(qs)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(getCloses).not.toHaveBeenCalled()
  })

  it('db error -> 500 INTERNAL', async () => {
    getCloses.mockRejectedValue(new Error('db down'))
    const res = await call('?pair=AUD-THB&range=7d')
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})
