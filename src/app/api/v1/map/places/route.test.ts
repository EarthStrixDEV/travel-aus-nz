import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const rpc = vi.fn()
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({ rpc: (...a: unknown[]) => rpc(...a) }) }))
vi.mock('@/lib/content/cache', () => ({ cachedContent: (_k: string[], _t: string, fn: () => unknown) => fn }))

import { GET } from './route'

const call = (qs: string) => GET(new NextRequest(`http://localhost:3000/api/v1/map/places${qs}`))
const SYD = 'bbox=150.9,-34.0,151.4,-33.7'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  rpc.mockResolvedValue({ data: { clusters: [], counts: {} }, error: null })
})

describe('GET /api/v1/map/places', () => {
  it('calls map_places with the parsed numbers and caches for 10 minutes', async () => {
    const res = await call(`?${SYD}&zoom=12`)
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('map_places', {
      min_lng: 150.9, min_lat: -34, max_lng: 151.4, max_lat: -33.7, p_zoom: 12, p_types: undefined,
    })
    expect(res.headers.get('cache-control')).toContain('s-maxage=600')
    expect(await res.json()).toEqual({ level: 'clusters', clusters: [], counts: {} })
  })

  it('folds types[] / types and floors a fractional zoom', async () => {
    rpc.mockResolvedValue({ data: { features: { type: 'FeatureCollection', features: [] }, counts: {} }, error: null })
    const res = await call(`?${SYD}&zoom=14.7&types[]=bar&types[]=cafe&types=station`)
    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('map_places', expect.objectContaining({ p_zoom: 14, p_types: ['bar', 'cafe', 'station'] }))
    expect(await res.json()).toEqual({ level: 'places', features: { type: 'FeatureCollection', features: [] }, counts: {} })
  })

  it.each([
    '?bbox=151,-34,150,-33&zoom=12',
    '?bbox=a,b,c,d&zoom=12',
    '?bbox=100,-50,160,-10&zoom=12',
    '?zoom=12',
    `?${SYD}&zoom=23`,
    `?${SYD}&zoom=-1`,
    `?${SYD}`,
    `?${SYD}&zoom=12&types[]=castle`,
  ])('%s -> 400 VALIDATION', async (qs) => {
    const res = await call(qs)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('zoom out of range says so', async () => {
    const res = await call(`?${SYD}&zoom=23`)
    expect((await res.json()).error.message).toBe('zoom must be 0-22')
  })

  it('RPC error -> 500 INTERNAL envelope', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'db down' } })
    const res = await call(`?${SYD}&zoom=12`)
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('INTERNAL')
  })
})
