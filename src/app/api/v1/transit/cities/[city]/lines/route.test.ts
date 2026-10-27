import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getCityLines = vi.fn()
vi.mock('@/lib/content/transport', () => ({ getCityLines: (...a: unknown[]) => getCityLines(...a) }))

import { GET } from './route'

const call = (city: string, qs = '') =>
  GET(new NextRequest(`http://localhost:3000/api/v1/transit/cities/${city}/lines${qs}`), { params: Promise.resolve({ city }) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  getCityLines.mockResolvedValue({ lines: [] })
})

describe('GET /api/v1/transit/cities/:city/lines', () => {
  it('passes city and mode; caches for 24 hours', async () => {
    const res = await call('sydney', '?mode=ferry')
    expect(res.status).toBe(200)
    expect(getCityLines).toHaveBeenCalledWith('sydney', 'ferry')
    expect(res.headers.get('cache-control')).toContain('s-maxage=86400')
    expect(await res.json()).toEqual({ lines: [] })
  })

  it('404 for an unknown city', async () => {
    getCityLines.mockResolvedValue(null)
    const res = await call('atlantis')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NOT_FOUND')
  })

  it('400 for an unknown mode or a malformed city, without reading', async () => {
    expect((await call('sydney', '?mode=rocket')).status).toBe(400)
    expect((await call('Sydney!')).status).toBe(400)
    expect(getCityLines).not.toHaveBeenCalled()
  })
})
