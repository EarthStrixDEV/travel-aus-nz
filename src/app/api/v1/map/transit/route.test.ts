import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const loadTransit = vi.fn()
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_k: string[], _t: string, fn: () => unknown) => fn }))
vi.mock('@/lib/content/places', () => ({ loadTransit: (...a: unknown[]) => loadTransit(...a) }))

import { GET } from './route'

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/api/v1/map/transit${qs}`))
const empty = { type: 'FeatureCollection', features: [] }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  loadTransit.mockResolvedValue({ lines: empty, stations: empty })
})

describe('GET /api/v1/map/transit', () => {
  it('passes city_id and modes[]; caches for 24 hours', async () => {
    const res = await call('?city_id=1&modes[]=train&modes[]=ferry')
    expect(res.status).toBe(200)
    expect(loadTransit).toHaveBeenCalledWith(expect.anything(), 1, ['train', 'ferry'])
    expect(res.headers.get('cache-control')).toContain('s-maxage=86400')
    expect(await res.json()).toEqual({ lines: empty, stations: empty })
  })

  it('no modes = all modes', async () => {
    await call('?city_id=2')
    expect(loadTransit).toHaveBeenCalledWith(expect.anything(), 2, [])
  })

  it.each(['', '?city_id=abc', '?city_id=0', '?city_id=1&modes[]=hovercraft'])('%s -> 400 VALIDATION', async (qs) => {
    const res = await call(qs)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(loadTransit).not.toHaveBeenCalled()
  })

  it('loader error -> 500 INTERNAL envelope', async () => {
    loadTransit.mockRejectedValue(new Error('db down'))
    const res = await call('?city_id=1')
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})
